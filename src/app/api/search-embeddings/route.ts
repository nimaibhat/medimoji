import { NextRequest, NextResponse } from 'next/server';
import { VectorDatabase } from '@/lib/vector-database';
import { EmbeddingService } from '@/lib/embedding-service';

export interface SearchEmbeddingsRequest {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
  useTextSearch?: boolean;
}

export interface SearchEmbeddingsResponse {
  success: boolean;
  message: string;
  data?: {
    results: Array<{
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
      similarity: number;
      distance?: number;
    }>;
    query: string;
    totalResults: number;
    searchTime: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SearchEmbeddingsResponse>> {
  const startTime = Date.now();
  
  try {
    const body: SearchEmbeddingsRequest = await request.json();
    
    // Validate required fields
    if (!body.query || body.query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Query is required',
        error: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    let results;
    
    if (body.useTextSearch) {
      // Search using text query (generates embedding first)
      results = await VectorDatabase.searchByText(body.query, {
        limit: body.limit || 10,
        threshold: body.threshold || 0.7,
        filters: body.filters,
      });
    } else {
      // Assume the query is already a vector (for advanced use cases)
      // This would require the client to provide the vector directly
      return NextResponse.json({
        success: false,
        message: 'Vector search not implemented in this endpoint. Use text search instead.',
        error: 'NOT_IMPLEMENTED'
      }, { status: 501 });
    }

    const searchTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Found ${results.length} similar results`,
      data: {
        results,
        query: body.query,
        totalResults: results.length,
        searchTime,
      }
    });

  } catch (error) {
    console.error('Error searching embeddings:', error);
    
    const searchTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      message: 'Failed to search embeddings',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        results: [],
        query: '',
        totalResults: 0,
        searchTime,
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');
    const title = searchParams.get('title');
    const author = searchParams.get('author');

    if (!query) {
      return NextResponse.json({
        success: false,
        message: 'Query parameter "q" is required',
        error: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const filters: Record<string, any> = {};
    if (title) filters.title = title;
    if (author) filters.author = author;

    const results = await VectorDatabase.searchByText(query, {
      limit,
      threshold,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Found ${results.length} similar results`,
      data: {
        results,
        query,
        totalResults: results.length,
        searchTime: 0,
      }
    });

  } catch (error) {
    console.error('Error searching embeddings:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to search embeddings',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

