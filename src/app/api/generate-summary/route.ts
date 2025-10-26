import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, conversationText, patientInfo } = await request.json();

    if (!conversationText || !patientInfo) {
      return NextResponse.json({
        success: false,
        error: 'Missing required data'
      }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a medical AI assistant specializing in creating comprehensive medical reports from doctor-patient conversations. Focus on accuracy, professionalism, and medical relevance."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent medical reports
    });

    const summary = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      summary: summary
    });

  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate summary'
    }, { status: 500 });
  }
}
