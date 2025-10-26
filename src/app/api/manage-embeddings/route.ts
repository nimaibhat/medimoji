import { NextRequest, NextResponse } from 'next/server';
import { VectorDatabase } from '@/lib/vector-database';

export interface ManageEmbeddingsResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ManageEmbeddingsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const articleTitle = searchParams.get('articleTitle');

    switch (action) {
      case 'stats':
        const stats = await VectorDatabase.getEmbeddingStats();
        return NextResponse.json({
          success: true,
          message: 'Embedding statistics retrieved successfully',
          data: stats
        });

      case 'get-article':
        if (!articleTitle) {
          return NextResponse.json({
            success: false,
            message: 'Article title is required for get-article action',
            error: 'VALIDATION_ERROR'
          }, { status: 400 });
        }
        
        const embeddings = await VectorDatabase.getArticleEmbeddings(articleTitle);
        return NextResponse.json({
          success: true,
          message: `Retrieved ${embeddings.length} embeddings for article "${articleTitle}"`,
          data: { embeddings, articleTitle }
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Supported actions: stats, get-article',
          error: 'VALIDATION_ERROR'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in manage-embeddings GET:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to process request',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<ManageEmbeddingsResponse>> {
  try {
    const body = await request.json();
    const { articleTitle, embeddingId } = body;

    if (articleTitle) {
      // Delete all embeddings for an article
      await VectorDatabase.deleteArticleEmbeddings(articleTitle);
      
      return NextResponse.json({
        success: true,
        message: `Successfully deleted all embeddings for article "${articleTitle}"`,
        data: { articleTitle }
      });
    } else if (embeddingId) {
      // Delete a specific embedding
      await VectorDatabase.deleteEmbedding(embeddingId);
      
      return NextResponse.json({
        success: true,
        message: `Successfully deleted embedding "${embeddingId}"`,
        data: { embeddingId }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Either articleTitle or embeddingId is required',
        error: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in manage-embeddings DELETE:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to delete embeddings',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

