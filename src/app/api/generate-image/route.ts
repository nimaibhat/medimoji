import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { ImagenService } from '@/lib/dalle-service';

export async function POST(request: NextRequest) {
  try {
    const { description, style, userId, mockImagePath } = await request.json();

    if (!description || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: description, userId' },
        { status: 400 }
      );
    }

    // Get user's API key from Firestore using Admin SDK
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const replicateApiKey = userDoc.exists
      ? userDoc.data()?.replicateApiKey
      : process.env.REPLICATE_API_TOKEN;
    if (!replicateApiKey) {
      return NextResponse.json(
        { error: 'Replicate API key not configured' },
        { status: 400 }
      );
    }

    // Create ImagenService directly with the API key (no Firestore query inside)
    const imagenService = new ImagenService(replicateApiKey, userId);
    
    const result = await imagenService.generateMedicalIllustrationWithMock(
      description,
      style || 'realistic',
      mockImagePath
    );
    console.log('API route result:', result);
    console.log('Result success:', result.success);
    console.log('Result imageUrl:', result.imageUrl);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Image generation API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}