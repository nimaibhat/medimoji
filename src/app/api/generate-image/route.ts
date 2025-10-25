import { NextRequest, NextResponse } from 'next/server';
import { createDALLEService } from '@/lib/dalle-service';

export async function POST(request: NextRequest) {
  try {
    const { description, style, userId } = await request.json();

    if (!description || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: description, userId' },
        { status: 400 }
      );
    }

    const dalleService = await createDALLEService(userId);
    const result = await dalleService.generateMedicalIllustration(
      description, 
      style || 'realistic'
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Image generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
