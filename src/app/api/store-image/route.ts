import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, conversationId, messageId } = await request.json();


    if (!imageUrl || !conversationId || !messageId) {
      console.error('Missing required parameters:', { imageUrl: !!imageUrl, conversationId: !!conversationId, messageId: !!messageId });
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Check environment variables
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('Firebase Storage bucket not configured');
      return NextResponse.json({ error: 'Firebase Storage bucket not configured' }, { status: 500 });
    }

    
    // Download the image server-side
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to download image:', response.status, response.statusText);
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    // Create a unique filename
    const timestamp = Date.now();
    const filename = `conversations/${conversationId}/${messageId}_${timestamp}.png`;
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);
    
    await file.save(Buffer.from(buffer), {
      metadata: {
        contentType: 'image/png',
      },
    });
    
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the permanent download URL
    const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    
    return NextResponse.json({ permanentUrl });
  } catch (error) {
    console.error('Error storing image permanently:', error);
    return NextResponse.json({ 
      error: 'Failed to store image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
