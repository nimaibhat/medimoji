import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise, descriptive titles for chat conversations. Generate a short, clear title (max 6 words) that captures the main topic or intent of the user's message. Examples: 'Email about meeting', 'Create heart diagram', 'Patient data analysis', 'Diabetes treatment query'. Keep it professional and medical-focused when appropriate."
        },
        {
          role: "user",
          content: `Create a title for this message: "${message}"`
        }
      ],
      max_tokens: 20,
      temperature: 0.3,
    });

    const title = completion.choices[0]?.message?.content?.trim() || 'New conversation';

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
