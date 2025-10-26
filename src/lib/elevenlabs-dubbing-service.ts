interface DubbingRequest {
  audioFile: File;
  targetLanguage: string;
  sourceLanguage?: string;
}

interface DubbingResponse {
  dubbing_id: string;
  status: 'pending' | 'processing' | 'dubbed' | 'failed';
  target_lang: string;
  created_at: string;
}

interface DubbingStatus {
  dubbing_id: string;
  status: 'pending' | 'processing' | 'dubbed' | 'failed';
  target_lang: string;
  created_at: string;
  error?: string;
}

interface DubbingLanguage {
  iso_639_1: string;
  name: string;
}

export class ElevenLabsDubbingService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static async create(): Promise<ElevenLabsDubbingService> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to environment variables.');
    }

    return new ElevenLabsDubbingService(apiKey);
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async makeFileRequest<T>(
    endpoint: string, 
    formData: FormData
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Start dubbing process
   */
  async startDubbing(audioFile: File, targetLanguage: string, allowWatermark: boolean = true): Promise<DubbingResponse> {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('target_lang', targetLanguage);
    
    // Allow watermark for free tier users
    if (allowWatermark) {
      formData.append('allow_watermark', 'true');
    }

    return this.makeFileRequest<DubbingResponse>('/dubbing', formData);
  }

  /**
   * Check dubbing status
   */
  async getDubbingStatus(dubbingId: string): Promise<DubbingStatus> {
    return this.makeRequest<DubbingStatus>(`/dubbing/${dubbingId}`);
  }

  /**
   * Get dubbed audio file
   */
  async getDubbedAudio(dubbingId: string, targetLanguage: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/dubbing/${dubbingId}/audio/${targetLanguage}`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response.blob();
  }

  /**
   * Get available languages for dubbing
   */
  async getAvailableLanguages(): Promise<Array<{ code: string; name: string }>> {
    // ElevenLabs supports these languages for dubbing
    return [
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
  }
}
