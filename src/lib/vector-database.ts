import { adminDb } from './firebase-admin';
import { VectorEmbedding, EmbeddingService } from './embedding-service';
import { FieldValue } from 'firebase-admin/firestore';

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: VectorEmbedding['metadata'];
  similarity: number;
  distance?: number;
}

export interface VectorQuery {
  vector: number[];
  limit?: number;
  threshold?: number;
  collection?: string;
  filters?: Record<string, any>;
}

export class VectorDatabase {
  private static readonly COLLECTION_NAME = 'article_embeddings';
  private static readonly INDEX_COLLECTION = 'vector_index';

  /**
   * Store vector embeddings in Firestore
   */
  static async upsertEmbeddings(embeddings: VectorEmbedding[]): Promise<void> {
    const batch = adminDb.batch();
    
    try {
      for (const embedding of embeddings) {
        const docRef = adminDb.collection(this.COLLECTION_NAME).doc(embedding.id);
        
        batch.set(docRef, {
          ...embedding,
          createdAt: embedding.createdAt,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
      console.log(`Successfully upserted ${embeddings.length} embeddings`);
    } catch (error) {
      console.error('Error upserting embeddings:', error);
      throw new Error(`Failed to store embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a single vector embedding
   */
  static async upsertEmbedding(embedding: VectorEmbedding): Promise<void> {
    try {
      const docRef = adminDb.collection(this.COLLECTION_NAME).doc(embedding.id);
      
      await docRef.set({
        ...embedding,
        createdAt: embedding.createdAt,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      
      console.log(`Successfully upserted embedding: ${embedding.id}`);
    } catch (error) {
      console.error('Error upserting embedding:', error);
      throw new Error(`Failed to store embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  static async searchSimilarVectors(query: VectorQuery): Promise<VectorSearchResult[]> {
    try {
      const collection = query.collection || this.COLLECTION_NAME;
      const limit = query.limit || 10;
      const threshold = query.threshold || 0.7;

      // Get all documents from the collection
      const snapshot = await adminDb.collection(collection).get();
      
      if (snapshot.empty) {
        return [];
      }

      const results: VectorSearchResult[] = [];

      // Calculate similarities for each document
      for (const doc of snapshot.docs) {
        const data = doc.data() as VectorEmbedding;
        
        // Apply filters if provided
        if (query.filters) {
          const matches = Object.entries(query.filters).every(([key, value]) => {
            const docValue = data.metadata[key as keyof typeof data.metadata];
            return docValue === value;
          });
          
          if (!matches) continue;
        }

        // Calculate cosine similarity
        const similarity = EmbeddingService.cosineSimilarity(query.vector, data.embedding);
        
        if (similarity >= threshold) {
          results.push({
            id: data.id,
            content: data.content,
            metadata: data.metadata,
            similarity,
            distance: 1 - similarity, // Convert similarity to distance
          });
        }
      }

      // Sort by similarity (descending) and limit results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Error searching similar vectors:', error);
      throw new Error(`Failed to search vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all embeddings for a specific article
   */
  static async getArticleEmbeddings(articleTitle: string): Promise<VectorEmbedding[]> {
    try {
      const snapshot = await adminDb
        .collection(this.COLLECTION_NAME)
        .where('metadata.title', '==', articleTitle)
        .orderBy('metadata.chunkIndex')
        .get();

      return snapshot.docs.map(doc => doc.data() as VectorEmbedding);
    } catch (error) {
      console.error('Error getting article embeddings:', error);
      throw new Error(`Failed to get article embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete all embeddings for a specific article
   */
  static async deleteArticleEmbeddings(articleTitle: string): Promise<void> {
    try {
      const snapshot = await adminDb
        .collection(this.COLLECTION_NAME)
        .where('metadata.title', '==', articleTitle)
        .get();

      const batch = adminDb.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Deleted ${snapshot.docs.length} embeddings for article: ${articleTitle}`);
    } catch (error) {
      console.error('Error deleting article embeddings:', error);
      throw new Error(`Failed to delete article embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get statistics about stored embeddings
   */
  static async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    uniqueArticles: number;
    averageChunksPerArticle: number;
  }> {
    try {
      const snapshot = await adminDb.collection(this.COLLECTION_NAME).get();
      
      const articles = new Set<string>();
      let totalChunks = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data() as VectorEmbedding;
        articles.add(data.metadata.title);
        totalChunks++;
      });

      return {
        totalEmbeddings: totalChunks,
        uniqueArticles: articles.size,
        averageChunksPerArticle: articles.size > 0 ? totalChunks / articles.size : 0,
      };
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      throw new Error(`Failed to get embedding stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for similar content using text query (generates embedding first)
   */
  static async searchByText(
    queryText: string,
    options: Omit<VectorQuery, 'vector'> = {}
  ): Promise<VectorSearchResult[]> {
    try {
      // Generate embedding for the query text
      const queryEmbedding = await EmbeddingService.generateEmbeddings([{
        id: 'query',
        content: queryText,
        metadata: { title: 'query', chunkIndex: 0, totalChunks: 1 },
      }]);

      // Search using the generated embedding
      return await this.searchSimilarVectors({
        ...options,
        vector: queryEmbedding[0].embedding,
      });
    } catch (error) {
      console.error('Error searching by text:', error);
      throw new Error(`Failed to search by text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing embedding
   */
  static async updateEmbedding(embedding: VectorEmbedding): Promise<void> {
    try {
      const docRef = adminDb.collection(this.COLLECTION_NAME).doc(embedding.id);
      
      await docRef.update({
        ...embedding,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`Successfully updated embedding: ${embedding.id}`);
    } catch (error) {
      console.error('Error updating embedding:', error);
      throw new Error(`Failed to update embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a specific embedding
   */
  static async deleteEmbedding(embeddingId: string): Promise<void> {
    try {
      await adminDb.collection(this.COLLECTION_NAME).doc(embeddingId).delete();
      console.log(`Successfully deleted embedding: ${embeddingId}`);
    } catch (error) {
      console.error('Error deleting embedding:', error);
      throw new Error(`Failed to delete embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

