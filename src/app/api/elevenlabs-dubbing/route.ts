import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/elevenlabs-dubbing-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const targetLanguage = formData.get('targetLanguage') as string;
    const sourceLanguage = formData.get('sourceLanguage') as string;

    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'Audio file is required'
      }, { status: 400 });
    }

    if (!targetLanguage) {
      return NextResponse.json({
        success: false,
        error: 'Target language is required'
      }, { status: 400 });
    }

    const dubbingService = await ElevenLabsDubbingService.create();
    
    // Start dubbing process with watermark allowed
    const dubbingResponse = await dubbingService.startDubbing(audioFile, targetLanguage, true);

    return NextResponse.json({
      success: true,
      dubbing: dubbingResponse
    });

  } catch (error) {
    console.error('ElevenLabs dubbing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const dubbingId = searchParams.get('dubbingId');
  const targetLanguage = searchParams.get('targetLanguage');

  try {
    const dubbingService = await ElevenLabsDubbingService.create();

    switch (action) {
      case 'status':
        if (!dubbingId) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID is required'
          }, { status: 400 });
        }

        const status = await dubbingService.getDubbingStatus(dubbingId);
        return NextResponse.json({
          success: true,
          status
        });

      case 'audio':
        if (!dubbingId || !targetLanguage) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID and target language are required'
          }, { status: 400 });
        }

        const audioBlob = await dubbingService.getDubbedAudio(dubbingId, targetLanguage);
        
        return new NextResponse(audioBlob, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="dubbed_audio_${targetLanguage}.mp3"`
          }
        });

      case 'languages':
        const languages = await dubbingService.getAvailableLanguages();
        return NextResponse.json({
          success: true,
          languages
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: status, audio, or languages'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('ElevenLabs API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
