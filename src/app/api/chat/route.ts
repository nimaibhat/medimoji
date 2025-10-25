import { NextRequest, NextResponse } from 'next/server';
import { processMessageWithAgent } from '@/lib/agents';

export async function POST(request: NextRequest) {
  try {
    const { agentType, message, userId } = await request.json();

    if (!agentType || !message || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: agentType, message, userId' },
        { status: 400 }
      );
    }

    const response = await processMessageWithAgent(agentType, message, userId);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
