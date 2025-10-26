import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const targetLanguage = formData.get('targetLanguage') as string;

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

    // Mock dubbing response
    const mockDubbingId = `mock_${Date.now()}`;
    
    return NextResponse.json({
      success: true,
      dubbing: {
        dubbing_id: mockDubbingId,
        status: 'pending',
        target_lang: targetLanguage,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Mock dubbing error:', error);
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
    switch (action) {
      case 'status':
        if (!dubbingId) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID is required'
          }, { status: 400 });
        }

        // Mock status - always return 'dubbed' after a short delay
        const status = {
          dubbing_id: dubbingId,
          status: 'dubbed' as const,
          target_lang: targetLanguage || 'es',
          created_at: new Date().toISOString()
        };

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

        // Mock audio - return a small audio file
        const mockAudioData = new Uint8Array(1024); // 1KB of mock audio
        const mockAudioBlob = new Blob([mockAudioData], { type: 'audio/mpeg' });
        
        return new NextResponse(mockAudioBlob, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="mock_dubbed_audio_${targetLanguage}.mp3"`
          }
        });

      case 'languages':
        const languages = [
          { code: 'es', name: 'Spanish' },
          { code: 'fr', name: 'French' },
          { code: 'de', name: 'German' },
          { code: 'it', name: 'Italian' },
          { code: 'pt', name: 'Portuguese' },
          { code: 'ar', name: 'Arabic' },
          { code: 'zh', name: 'Chinese' },
          { code: 'ja', name: 'Japanese' },
          { code: 'ko', name: 'Korean' },
          { code: 'hi', name: 'Hindi' },
          { code: 'en', name: 'English' }
        ];
        
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
    console.error('Mock API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
