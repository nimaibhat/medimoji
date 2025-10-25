import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, message } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Test the API key with a simple completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 10,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'API key is valid',
      response: completion.choices[0]?.message?.content || 'No response'
    });
  } catch (error) {
    console.error('OpenAI API test error:', error);
    return NextResponse.json({ 
      error: 'API key test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

