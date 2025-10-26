import Replicate from "replicate";
import { writeFile } from "fs/promises";

export interface ImageGenerationRequest {
  prompt: string;
  style?: 'realistic' | 'schematic' | 'patient-friendly' | 'comic';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  annotations?: boolean;
  mockImagePath?: string; // Reference or guide image path/url
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
    const replicateApiKey = userData.replicateApiKey || process.env.REPLICATE_API_TOKEN;
    console.log('replicateApiKey configured:', !!replicateApiKey);
    
    
    if (!replicateApiKey) {
      throw new Error('User has not configured their Replicate API key. Please add your Replicate API key in settings.');
    }
    
    return new ImagenService(replicateApiKey, userId);
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      // Check if API key is available
      if (!this.apiKey) {
        return {
          success: false,
          error: 'Replicate API key not configured. Please add your API key in settings.'
        };
      }

      // Enhance the prompt for medical accuracy, including possible mock image
      const enhancedPrompt = this.enhanceMedicalPrompt(request.prompt, request.style, request.mockImagePath);
      
      // Convert size to aspect ratio
      const aspectRatio = this.convertSizeToAspectRatio(request.size);
      
      const input = {
        prompt: enhancedPrompt,
        aspect_ratio: aspectRatio,
        safety_filter_level: "block_medium_and_above"
      };

      // Run Imagen 4 via Replicate
      const output = await this.replicate.run("google/imagen-4", { input });
      console.log('Replicate output:', output);
      console.log('Output type:', typeof output);
      console.log('Is array:', Array.isArray(output));
      
      // Replicate returns a ReadableStream or object with url function
      let imageUrl: string | undefined;
      if (typeof output === 'object' && output !== null) {
        if ('url' in output && typeof output.url === 'function') {
          imageUrl = await output.url();
        } else if (Array.isArray(output) && output.length > 0) {
          imageUrl = output[0];
        } else if (typeof output === 'string') {
          imageUrl = output;
        }
      }
      
      console.log('Extracted imageUrl:', imageUrl);

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

  private enhanceMedicalPrompt(prompt: string, style?: string, mockImagePath?: string): string {
    let enhancedPrompt = prompt;
    
    // Add basic medical accuracy
    enhancedPrompt += ', medically accurate, professional medical illustration';
    
    // Add style-specific enhancements
    switch (style) {
      case 'realistic':
        enhancedPrompt += ', photorealistic, clinical quality, detailed, high resolution';
        break;
      case 'schematic':
        enhancedPrompt += ', schematic diagram, clean lines, technical drawing style, labeled diagram';
        break;
      case 'patient-friendly':
        enhancedPrompt += ', simplified, easy to understand, educational, clear and friendly';
        break;
      case 'comic':
        enhancedPrompt += ', cartoon style, colorful, engaging, illustrated';
        break;
      default:
        enhancedPrompt += ', clear medical illustration, professional';
    }
    
    // Force panel-based layout and no text
    enhancedPrompt += ', create multiple panels showing different aspects, NO TEXT OR WORDS, NO LABELS, NO CAPTIONS, NO WRITING, visual only, panel-based layout';
    
    if (mockImagePath) {
      // Handle multiple reference images
      const imagePaths = mockImagePath.split(',').map(path => path.trim());
      if (imagePaths.length === 1) {
        enhancedPrompt += `. Reference the visual style, composition, and detail level of this image: ${mockImagePath}`;
      } else {
        enhancedPrompt += `. Reference the visual style, composition, and detail level of these images: ${imagePaths.join(', ')}`;
      }
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

  async generateMedicalIllustrationWithMock(
    description: string,
    style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic',
    mockImagePath?: string
  ): Promise<ImageGenerationResponse> {
    const result = await this.generateImage({
      prompt: description,
      style,
      size: '1024x1024',
      quality: 'hd',
      mockImagePath
    });
    
    // Generate captions for the panels if image generation was successful
    if (result.success && result.imageUrl) {
      const captions = await this.generatePanelCaptions(description, result.imageUrl);
      return {
        ...result,
        panelCaptions: captions
      };
    }
    
    return result;
  }

  private async generatePanelCaptions(description: string, imageUrl: string): Promise<string> {
    try {
      // Use OpenAI to analyze the image and generate panel captions
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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