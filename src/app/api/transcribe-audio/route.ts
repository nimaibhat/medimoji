import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { audioUrl, language, conversationId } = await request.json();

    if (!audioUrl || !language) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    console.log(`Server-side transcription for ${language} audio:`, audioUrl);

    // Fetch the audio file server-side (bypasses CORS)
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    // Convert blob to file for OpenAI Whisper API
    const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });

    // Transcribe using OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language === 'en' ? 'en' : language === 'es' ? 'es' : undefined,
      response_format: 'text'
    });

    console.log(`Transcription completed for ${language}:`, transcription);

    return NextResponse.json({
      success: true,
      transcription: transcription,
      language: language,
      audioUrl: audioUrl
    });

  } catch (error) {
    console.error('Error in server-side transcription:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to transcribe audio'
    }, { status: 500 });
  }
}
