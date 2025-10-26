'use client';

import { ElevenLabsDubbingService } from '@/lib/elevenlabs-dubbing-service';

export class TranscriptionService {
  private static readonly TRANSCRIPTION_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';

  /**
   * Transcribe audio using server-side API (bypasses CORS)
   */
  static async transcribeAudioServerSide(audioUrl: string, language: string): Promise<string> {
    try {
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          language: language
        }),
      });

      if (!response.ok) {
        throw new Error(`Server-side transcription failed: ${response.status}`);
      }

      const result = await response.json();
      return result.transcription || '';
    } catch (error) {
      console.error('Error in server-side transcription:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Transcribe audio using ElevenLabs Speech-to-Text API
   */
  static async transcribeAudio(audioBlob: Blob, language: string = 'en'): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.mp3');
      formData.append('language', language);
      formData.append('model', 'whisper-1'); // ElevenLabs uses Whisper model

      const response = await fetch(this.TRANSCRIPTION_ENDPOINT, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY!,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      return result.text || '';
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Transcribe multiple audio files and return combined transcript
   */
  static async transcribeConversation(
    audioTracks: Array<{ audioUrl: string; language: string; timestamp: string; type?: string }>
  ): Promise<Array<{ timestamp: string; language: string; text: string; audioType?: string }>> {
    const transcripts = [];

    for (const track of audioTracks) {
      try {
        console.log(`Transcribing ${track.type || 'unknown'} ${track.language} audio from ${track.timestamp}`);
        
        // Use server-side transcription to bypass CORS
        const transcription = await this.transcribeAudioServerSide(track.audioUrl, track.language);
        
        transcripts.push({
          timestamp: track.timestamp,
          language: track.language,
          text: transcription,
          audioType: track.type || 'unknown'
        });

        console.log(`Transcription completed for ${track.language} ${track.type || 'unknown'}:`, transcription);
      } catch (error) {
        console.error(`Failed to transcribe ${track.type || 'unknown'} ${track.language} audio:`, error);
        // Continue with other tracks even if one fails
        transcripts.push({
          timestamp: track.timestamp,
          language: track.language,
          text: `[Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          audioType: track.type || 'unknown'
        });
      }
    }

    return transcripts;
  }

  /**
   * Generate conversation summary using OpenAI
   */
  static async generateConversationSummary(
    transcripts: Array<{ timestamp: string; language: string; text: string }>,
    patientInfo: any
  ): Promise<string> {
    try {
      // Combine all transcripts into a single text
      const conversationText = transcripts
        .map(t => `[${t.timestamp}] (${t.language}): ${t.text}`)
        .join('\n');

      const prompt = `
You are a medical AI assistant. Please analyze this doctor-patient conversation and create a comprehensive medical summary.

Patient Information:
- Patient ID: ${patientInfo.patientId || 'Not provided'}
- Visit Type: ${patientInfo.visitType}
- Doctor: ${patientInfo.doctorName}
- Date: ${patientInfo.date}

Conversation Transcript:
${conversationText}

Please provide a structured medical summary including:
1. Chief Complaint/Reason for Visit
2. Patient History Discussed
3. Symptoms Described
4. Treatment Recommendations
5. Follow-up Instructions
6. Language Barriers Addressed
7. Key Points for Medical Records

IMPORTANT: Do NOT include patient names or any personally identifiable information (PII) in the report. Use "Patient" or "Patient ID" instead of names. This report must be HIPAA compliant.

Format as a professional medical report.
`;

      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          conversationText: conversationText,
          patientInfo: patientInfo
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const result = await response.json();
      return result.summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate conversation summary');
    }
  }
}
