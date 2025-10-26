import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ArticleChunk {
  id: string;
  content: string;
  metadata: {
    title: string;
    author?: string;
    url?: string;
    publishedDate?: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface VectorEmbedding {
  id: string;
  embedding: number[];
  content: string;
  metadata: ArticleChunk['metadata'];
  createdAt: Date;
}

export class EmbeddingService {
  private static readonly CHUNK_SIZE = 1000; // Characters per chunk
  private static readonly CHUNK_OVERLAP = 200; // Overlap between chunks

  /**
   * Split article content into chunks for embedding
   */
  static splitIntoChunks(content: string, metadata: Partial<ArticleChunk['metadata']> = {}): ArticleChunk[] {
    const chunks: ArticleChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < content.length) {
      const end = Math.min(start + this.CHUNK_SIZE, content.length);
      let chunkContent = content.slice(start, end);

      // Try to break at sentence boundaries
      if (end < content.length) {
        const lastSentenceEnd = chunkContent.lastIndexOf('.');
        const lastParagraphEnd = chunkContent.lastIndexOf('\n\n');
        const breakPoint = Math.max(lastSentenceEnd, lastParagraphEnd);
        
        if (breakPoint > start + this.CHUNK_SIZE * 0.5) {
          chunkContent = content.slice(start, start + breakPoint + 1);
        }
      }

      chunks.push({
        id: `${metadata.title || 'article'}-chunk-${chunkIndex}`,
        content: chunkContent.trim(),
        metadata: {
          title: metadata.title || 'Untitled Article',
          author: metadata.author,
          url: metadata.url,
          publishedDate: metadata.publishedDate,
          chunkIndex,
          totalChunks: 0, // Will be updated after all chunks are created
        },
      });

      start += chunkContent.length - this.CHUNK_OVERLAP;
      chunkIndex++;
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Generate embeddings for article chunks
   */
  static async generateEmbeddings(chunks: ArticleChunk[]): Promise<VectorEmbedding[]> {
    const embeddings: VectorEmbedding[] = [];

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map(chunk => chunk.content),
        });

        batch.forEach((chunk, index) => {
          embeddings.push({
            id: chunk.id,
            embedding: response.data[index].embedding,
            content: chunk.content,
            metadata: chunk.metadata,
            createdAt: new Date(),
          });
        });

        // Add small delay between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error generating embeddings for batch ${i}-${i + batchSize}:`, error);
        throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return embeddings;
  }

  /**
   * Process a complete article and generate embeddings
   */
  static async processArticle(
    content: string,
    metadata: Partial<ArticleChunk['metadata']> = {}
  ): Promise<VectorEmbedding[]> {
    const chunks = this.splitIntoChunks(content, metadata);
    return await this.generateEmbeddings(chunks);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find similar chunks based on query embedding
   */
  static findSimilarChunks(
    queryEmbedding: number[],
    chunks: VectorEmbedding[],
    limit: number = 5,
    threshold: number = 0.7
  ): Array<VectorEmbedding & { similarity: number }> {
    const similarities = chunks.map(chunk => ({
      ...chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}

