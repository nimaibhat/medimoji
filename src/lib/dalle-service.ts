
export interface ImageGenerationRequest {
  prompt: string;
  style?: 'realistic' | 'schematic' | 'patient-friendly' | 'comic';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  annotations?: boolean;
}

export interface ImageGenerationResponse {
  success: boolean;
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
}

export class DALLEService {
  private apiKey: string;
  private userId: string;

  constructor(apiKey: string, userId: string) {
    this.apiKey = apiKey;
    this.userId = userId;
  }

  static async forUser(userId: string): Promise<DALLEService> {
    const { db } = await import('./firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    const openaiApiKey = userData.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      throw new Error('User has not configured their OpenAI API key. Please add your OpenAI API key in settings.');
    }
    
    return new DALLEService(openaiApiKey, userId);
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      // Check if API key is available
      if (!this.apiKey) {
        return {
          success: false,
          error: 'OpenAI API key not configured. Please add your API key in settings.'
        };
      }

      // Enhance the prompt for medical accuracy
      const enhancedPrompt = this.enhanceMedicalPrompt(request.prompt, request.style);
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: enhancedPrompt,
          n: 1,
          size: request.size || '1024x1024',
          quality: request.quality || 'standard',
          style: 'natural' // DALL-E 3 style
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DALL-E API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        imageUrl: data.data[0].url,
        revisedPrompt: data.data[0].revised_prompt
      };

    } catch (error) {
      console.error('DALL-E generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private enhanceMedicalPrompt(prompt: string, style?: string): string {
    let enhancedPrompt = prompt;
    
    // Add basic medical accuracy
    enhancedPrompt += ', medically accurate, professional medical illustration';
    
    // Add style-specific enhancements
    switch (style) {
      case 'realistic':
        enhancedPrompt += ', photorealistic, clinical quality, detailed';
        break;
      case 'schematic':
        enhancedPrompt += ', schematic diagram, clean lines, technical drawing style';
        break;
      case 'patient-friendly':
        enhancedPrompt += ', simplified, easy to understand, educational';
        break;
      case 'comic':
        enhancedPrompt += ', cartoon style, comic panels, colorful, engaging';
        break;
      default:
        enhancedPrompt += ', clear medical illustration, professional';
    }
    
    return enhancedPrompt;
  }


  async generateMedicalIllustration(
    description: string, 
    style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic'
  ): Promise<ImageGenerationResponse> {
    return await this.generateImage({
      prompt: description,
      style,
      size: '1024x1024',
      quality: 'hd'
    });
  }

}

export async function createDALLEService(userId: string): Promise<DALLEService> {
  return await DALLEService.forUser(userId);
}
