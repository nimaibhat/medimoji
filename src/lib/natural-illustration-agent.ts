import { LangGraphClient } from './langgraph-client';
import { ImagenClientService } from './imagen-client';
import { AgentResponse } from './agents';
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

      // Build the prompt
      const enhancedPrompt = this.buildTextFreePrompt(
        request.prompt, 
        request.style, 
        request.mockImagePath,
        request.attemptNumber || 1
      );
      
      const aspectRatio = this.convertSizeToAspectRatio(request.size);
      
      // MATCH PLAYGROUND FORMAT EXACTLY
      const input = {
        aspect_ratio: aspectRatio,
        output_format: "jpg", // Added - playground default
        prompt: enhancedPrompt,
        safety_filter_level: "block_medium_and_above"
        // Note: No negative_prompt - Imagen 4 doesn't support it!
      };

      console.log('Generating with input:', JSON.stringify(input, null, 2));

      const output = await this.replicate.run("google/imagen-4", { input });
      
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
   * Build text-free prompt using PLAYGROUND-STYLE formatting
   * Key insight: The playground uses natural language descriptions, not instructions
   */
  private buildTextFreePrompt(
    description: string, 
    style?: string, 
    mockImagePath?: string,
    attemptNumber: number = 1
  ): string {
    
    // Get style-specific visual description
    const styleDescription = this.getStyleDescription(style);
    
    // Build prompt in DESCRIPTIVE style (like playground example)
    // Focus on WHAT THE IMAGE SHOWS, not instructions to the model
    const fullPrompt = `${styleDescription}: ${description}. Visual communication using icons, arrows, color coding, symbols, gestures, and expressions. Multi-panel sequential layout showing step-by-step progression. No text, labels, or written words anywhere in the image.`;

    return fullPrompt;
  }

  /**
   * Style descriptions in DESCRIPTIVE format (not instructional)
   * Following the playground's "The photo:" style
   */
  private getStyleDescription(style?: string): string {
    const styleMap: { [key: string]: string } = {
      'realistic': 'A photorealistic medical illustration with clinical quality, detailed anatomy, professional medical photography aesthetic with soft lighting',

      'schematic': 'A technical medical diagram with clean lines, cross-sectional views, color-coded components in engineering blueprint style',

      'patient-friendly': 'A simple, approachable medical illustration with soft colors, gentle visual style, easy-to-understand graphics',

      'comic': 'A colorful medical comic-style illustration with friendly cartoon aesthetics, sequential panels telling a visual story',

      'cartoon': 'A friendly cartoon-style medical illustration with rounded shapes, expressive characters using gestures and emotions, simplified visual storytelling in sequential panels',

      'infographic': 'An IKEA-style visual instruction diagram with clean geometric icons, grid-based layout, color-coded sections, and visual flow indicators',

      'pictogram': 'A universal pictogram-style medical illustration with simplified iconic stick figures, high-contrast silhouettes, emergency sign aesthetic'
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

export class NaturalIllustrationAgent {
  private langGraphClient: LangGraphClient;
  private imagenClient: ImagenClientService;
  private userId: string;

  constructor(langGraphClient: LangGraphClient, imagenClient: ImagenClientService, userId: string) {
    this.langGraphClient = langGraphClient;
    this.imagenClient = imagenClient;
    this.userId = userId;
  }

  async processMessage(message: string): Promise<AgentResponse> {
    const systemPrompt = `You are an intelligent medical illustration assistant. You help medical professionals create accurate, engaging medical illustrations and diagrams in cartoon/comic style.

Your capabilities:
-Do not label the words since they are illiterate;
- Generate anatomical diagrams and cross-sections in comic format
- Create surgical procedure illustrations with panels and boxes
- Design patient education materials in cartoon style
- Produce medical charts and visual aids with comic elements
- Ensure medical accuracy while making content fun and engaging

When a user requests an illustration, analyze their request and determine:
1. What type of illustration they need
2. The appropriate style (realistic, schematic, patient-friendly, anatomical, comic)
3. Any specific requirements or details

Default to comic/cartoon style with panels, boxes, and engaging visual elements. Always prioritize medical accuracy while making the content visually appealing and educational.`;

    try {
      // First, extract the illustration intent
      const intent = await this.extractIllustrationIntent(message);
      
      // Generate the image
      const imageResult = await this.generateIllustration(intent);
      
      if (imageResult.success) {
        return {
          content: `🎨 **Medical Illustration Generated**\n\nI've created a ${intent.style} medical illustration for you.\n\n**Description:** ${intent.description}\n\n**Style:** ${intent.style}\n**Type:** ${intent.type}`,
          toolCalls: [{
            id: 'illustration_generated',
            type: 'image_generation',
            function: {
              name: 'generate_medical_illustration',
              arguments: JSON.stringify({
                imageUrl: imageResult.imageUrl,
                description: intent.description,
                style: intent.style,
                revisedPrompt: imageResult.revisedPrompt
              })
            }
          }]
        };
      } else {
        return {
          content: `❌ **Illustration Generation Failed**\n\nI encountered an error while generating your medical illustration: ${imageResult.error}\n\nPlease try rephrasing your request or contact support if the issue persists.`
        };
      }

    } catch (error) {
      console.error('Error in illustration processing:', error);
      return {
        content: `I'm having trouble processing your illustration request. Please try rephrasing your request or contact support if the issue persists.`
      };
    }
  }

  private async extractIllustrationIntent(message: string): Promise<any> {
    // Simple intent extraction - can be enhanced with AI
    const lowerMessage = message.toLowerCase();
    
    let type = 'general';
    if (lowerMessage.includes('anatomy') || lowerMessage.includes('organ')) {
      type = 'anatomical';
    } else if (lowerMessage.includes('surgery') || lowerMessage.includes('procedure')) {
      type = 'surgical';
    } else if (lowerMessage.includes('education') || lowerMessage.includes('patient')) {
      type = 'educational';
    }
    
    let style = 'comic';
    if (lowerMessage.includes('realistic')) {
      style = 'realistic';
    } else if (lowerMessage.includes('schematic') || lowerMessage.includes('diagram')) {
      style = 'schematic';
    } else if (lowerMessage.includes('patient') || lowerMessage.includes('simple')) {
      style = 'patient-friendly';
    }
    
    return {
      type,
      description: message,
      style,
      annotations: lowerMessage.includes('label') || lowerMessage.includes('annotate')
    };
  }

  private async generateIllustration(intent: any): Promise<any> {
    try {
      return await this.imagenClient.generateMedicalIllustrationWithMock(
        intent.description,
        intent.style,
        "/public/example.png"
      );
    } catch (error) {
      console.error('Error generating illustration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export async function createNaturalIllustrationAgent(userId: string): Promise<NaturalIllustrationAgent> {
  const langGraphClient = await LangGraphClient.forUser(userId);
  const imagenClient = new ImagenClientService(userId);
  return new NaturalIllustrationAgent(langGraphClient, imagenClient, userId);
}

export async function createImagenService(userId: string): Promise<ImagenService> {
  return await ImagenService.forUser(userId);
}