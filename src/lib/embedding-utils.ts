import { EmbeddingService, ArticleChunk } from './embedding-service';
import { VectorDatabase } from './vector-database';

/**
 * Utility functions for working with vector embeddings
 */
export class EmbeddingUtils {
  /**
   * Process and store an article from a URL or text content
   */
  static async processArticleFromSource(
    source: string,
    options: {
      title: string;
      author?: string;
      url?: string;
      publishedDate?: string;
      isUrl?: boolean;
    }
  ): Promise<{
    success: boolean;
    embeddingsCount: number;
    processingTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      let content: string;
      
      if (options.isUrl) {
        // In a real implementation, you would fetch the content from the URL
        // For now, we'll assume the source is already the content
        content = source;
      } else {
        content = source;
      }

      // Process the article
      const embeddings = await EmbeddingService.processArticle(content, {
        title: options.title,
        author: options.author,
        url: options.url,
        publishedDate: options.publishedDate,
      });

      // Store in Firebase
      await VectorDatabase.upsertEmbeddings(embeddings);

      return {
        success: true,
        embeddingsCount: embeddings.length,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        embeddingsCount: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for similar content and return formatted results
   */
  static async searchSimilarContent(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      filters?: Record<string, any>;
    } = {}
  ): Promise<{
    success: boolean;
    results: Array<{
      title: string;
      content: string;
      similarity: number;
      metadata: any;
    }>;
    error?: string;
  }> {
    try {
      const results = await VectorDatabase.searchByText(query, {
        limit: options.limit || 5,
        threshold: options.threshold || 0.7,
        filters: options.filters,
      });

      return {
        success: true,
        results: results.map(result => ({
          title: result.metadata.title,
          content: result.content,
          similarity: result.similarity,
          metadata: result.metadata,
        })),
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a summary of all stored embeddings
   */
  static async getEmbeddingSummary(): Promise<{
    success: boolean;
    stats?: {
      totalEmbeddings: number;
      uniqueArticles: number;
      averageChunksPerArticle: number;
    };
    error?: string;
  }> {
    try {
      const stats = await VectorDatabase.getEmbeddingStats();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old or duplicate embeddings
   */
  static async cleanupEmbeddings(articleTitle?: string): Promise<{
    success: boolean;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      if (articleTitle) {
        // Get current count before deletion
        const embeddings = await VectorDatabase.getArticleEmbeddings(articleTitle);
        const count = embeddings.length;
        
        // Delete all embeddings for the article
        await VectorDatabase.deleteArticleEmbeddings(articleTitle);
        
        return {
          success: true,
          deletedCount: count,
        };
      } else {
        // In a real implementation, you might want to clean up old embeddings
        // based on date or other criteria
        return {
          success: true,
          deletedCount: 0,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate that all required environment variables are set
   */
  static validateEnvironment(): {
    isValid: boolean;
    missingVars: string[];
  } {
    const requiredVars = [
      'OPENAI_API_KEY',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    return {
      isValid: missingVars.length === 0,
      missingVars,
    };
  }
}

