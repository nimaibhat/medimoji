import Replicate from "replicate";

export interface ImageGenerationRequest {
  prompt: string;
  style?: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' | 'cartoon' | 'infographic' | 'pictogram';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  annotations?: boolean;
  mockImagePath?: string;
  attemptNumber?: number;
}

export interface ImageGenerationResponse {
  success: boolean;
  imageUrl?: string;
  revisedPrompt?: string;
  panelCaptions?: string;
  error?: string;
}

export class ImagenService {
  private apiKey: string;
  private userId: string;
  private replicate: Replicate;

  constructor(apiKey: string, userId: string) {
    this.apiKey = apiKey;
    this.userId = userId;
    this.replicate = new Replicate({ auth: apiKey });
  }

  static async forUser(userId: string): Promise<ImagenService> {
    const { db } = await import('./firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    const replicateApiKey = userData.replicateApiKey || process.env.REPLICATE_API_KEY;
    
    if (!replicateApiKey) {
      throw new Error('User has not configured their Replicate API key. Please add your Replicate API key in settings.');
    }
    
    return new ImagenService(replicateApiKey, userId);
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'Replicate API key not configured. Please add your API key in settings.'
        };
      }

      // Build SHORT, POSITIVE prompt
      const enhancedPrompt = this.buildTextFreePrompt(
        request.prompt, 
        request.style, 
        request.mockImagePath,
        request.attemptNumber || 1
      );
      
      const aspectRatio = this.convertSizeToAspectRatio(request.size);
      
      const input = {
        prompt: enhancedPrompt,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        safety_filter_level: "block_medium_and_above"
      };

      console.log('Generating with prompt:', enhancedPrompt);
      console.log('Input parameters:', input);

      // Run google/imagen-4 using the exact playground format
      const output = await this.replicate.run("google/imagen-4", { input });
      
      // Get the image URL using the correct method from playground
      const imageUrl = (output as any).url();
      console.log('Generated imageUrl:', imageUrl);

      return {
        success: true,
        imageUrl: imageUrl,
        revisedPrompt: enhancedPrompt
      };

    } catch (error) {
      console.error('Imagen generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * SIMPLIFIED TEXT-FREE PROMPT - Focus on positive instructions
   */
  private buildTextFreePrompt(
    description: string, 
    style?: string, 
    mockImagePath?: string,
    attemptNumber: number = 1
  ): string {
    
    // Get style-specific instructions
    const styleInstructions = this.getStyleVisualInstructions(style);
    
    // Use EXACT playground format for best results
    const fullPrompt = `The photo: Create a medical cartoon to explain ${description}. Keep the text to an absolute minimal and divide up the steps into different panels, emphasizing each action through a cartoon. Keep the images colorful, cheery, and straight to the point.`;

    return fullPrompt;
  }

  /**
   * Simplified style instructions - POSITIVE framing only
   */
  private getStyleVisualInstructions(style?: string): string {
    const styleMap: { [key: string]: string } = {
      'realistic': `Medical illustration with photorealistic detail, clinical quality, accurate anatomy`,

      'schematic': `Technical diagram with clean lines, cross-sections, color-coded components, engineering style`,

      'patient-friendly': `Simple illustration with soft colors, approachable style, easy to understand visuals`,

      'comic': `Colorful illustrated style with sequential panels, friendly and engaging, visual storytelling`,

      'cartoon': `Simplified cartoon style with expressive characters, rounded shapes, visual gestures and emotions, sequential panels showing progression`,

      'infographic': `IKEA-style visual instructions with clean icons, geometric shapes, grid layout, color-coded sections, visual flow indicators`,

      'pictogram': `Universal pictogram style with simplified iconic forms, stick figures, clear silhouettes, high contrast, instant recognition`
    };

    return styleMap[style || 'comic'] || styleMap['comic'];
  }

  private convertSizeToAspectRatio(size?: string): string {
    switch (size) {
      case '1792x1024':
        return '16:9';
      case '1024x1792':
        return '9:16';
      case '1024x1024':
      default:
        return '1:1';
    }
  }

  async generateMedicalIllustration(
    description: string, 
    style: 'realistic' | 'comic' = 'comic'
  ): Promise<ImageGenerationResponse> {
    return await this.generateImage({
      prompt: description,
      style,
      size: '1792x1024',
      quality: 'hd'
    });
  }

  async generateMedicalIllustrationWithMock(
    description: string,
    style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic',
    mockImagePath?: string
  ): Promise<ImageGenerationResponse> {
    const result = await this.generateImage({
      prompt: description,
      style,
      size: '1792x1024',
      quality: 'hd',
      mockImagePath
    });
    
    if (result.success && result.imageUrl) {
      const captions = await this.generatePanelCaptions(description, result.imageUrl);
      return {
        ...result,
        panelCaptions: captions
      };
    }
    
    return result;
  }

  /**
   * Generate with retry logic
   */
  async generateTextFreeIllustration(
    description: string,
    style: 'realistic' | 'comic' | 'cartoon' | 'infographic' | 'pictogram' = 'comic',
    maxAttempts: number = 3
  ): Promise<ImageGenerationResponse> {
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt}/${maxAttempts} for text-free illustration`);
      
      const result = await this.generateImage({
        prompt: description,
        style,
        size: '1792x1024',
        quality: 'hd',
        attemptNumber: attempt
      });

      if (!result.success) {
        continue;
      }

      if (attempt === maxAttempts) {
        console.warn('Max attempts reached, returning best result');
        return result;
      }
    }

    return {
      success: false,
      error: 'Failed to generate text-free illustration after multiple attempts'
    };
  }

  private async generatePanelCaptions(description: string, imageUrl: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this medical illustration and provide detailed captions for each panel. The original request was: "${description}". Provide captions that explain what each panel shows in medical terms, suitable for medical professionals. Format as: "Panel 1: [description]", "Panel 2: [description]", etc.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (!response.ok) {
        console.error('Failed to generate captions:', response.statusText);
        return 'Panel captions could not be generated.';
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Panel captions could not be generated.';
    } catch (error) {
      console.error('Error generating panel captions:', error);
      return 'Panel captions could not be generated.';
    }
  }
}

export async function createImagenService(userId: string): Promise<ImagenService> {
  return await ImagenService.forUser(userId);
}