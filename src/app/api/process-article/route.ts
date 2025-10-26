import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingService } from '@/lib/embedding-service';
import { VectorDatabase } from '@/lib/vector-database';

export interface ProcessArticleRequest {
  content: string;
  title: string;
  author?: string;
  url?: string;
  publishedDate?: string;
  replaceExisting?: boolean;
}

export interface ProcessArticleResponse {
  success: boolean;
  message: string;
  data?: {
    embeddingsCount: number;
    articleTitle: string;
    processingTime: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ProcessArticleResponse>> {
  const startTime = Date.now();
  
  try {
    const body: ProcessArticleRequest = await request.json();
    
    // Validate required fields
    if (!body.content || !body.title) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: content and title are required',
        error: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Validate content length
    if (body.content.length < 100) {
      return NextResponse.json({
        success: false,
        message: 'Content must be at least 100 characters long',
        error: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Check if we should replace existing embeddings
    if (body.replaceExisting) {
      await VectorDatabase.deleteArticleEmbeddings(body.title);
    }

    // Process the article and generate embeddings
    const embeddings = await EmbeddingService.processArticle(body.content, {
      title: body.title,
      author: body.author,
      url: body.url,
      publishedDate: body.publishedDate,
    });

    // Store embeddings in Firebase
    await VectorDatabase.upsertEmbeddings(embeddings);

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Successfully processed article "${body.title}" with ${embeddings.length} chunks`,
      data: {
        embeddingsCount: embeddings.length,
        articleTitle: body.title,
        processingTime,
      }
    });

  } catch (error) {
    console.error('Error processing article:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      message: 'Failed to process article',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        embeddingsCount: 0,
        articleTitle: '',
        processingTime,
      }
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await VectorDatabase.getEmbeddingStats();
    
    return NextResponse.json({
      success: true,
      message: 'Embedding statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error getting embedding stats:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve embedding statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

