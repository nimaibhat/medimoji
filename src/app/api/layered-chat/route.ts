import { NextRequest, NextResponse } from 'next/server';
import { processMessageWithLayeredAgent } from '@/lib/layered-message-processor';

export async function POST(request: NextRequest) {
  try {
    const { message, userId, selectedAgent } = await request.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, userId' },
        { status: 400 }
      );
    }

    const response = await processMessageWithLayeredAgent(message, userId, selectedAgent);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Layered chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
