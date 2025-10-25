export interface ImageGenerationRequest {
    prompt: string;
    style?: 'realistic' | 'schematic' | 'patient-friendly' | 'comic';
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    annotations?: boolean;
    mockImagePath?: string;
  }
  
  export interface ImageGenerationResponse {
    success: boolean;
    imageUrl?: string;
    revisedPrompt?: string;
    panelCaptions?: string;
    error?: string;
  }
  
  export class ImagenClientService {
    private userId: string;
  
    constructor(userId: string) {
      this.userId = userId;
    }
  
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: request.prompt,
            style: request.style || 'realistic',
            userId: this.userId,
            mockImagePath: request.mockImagePath,
            size: request.size,
            quality: request.quality,
          }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            error: errorData.error || `API error: ${response.status}`,
          };
        }
  
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Imagen generation error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  
    async generateMedicalIllustration(
      description: string,
      style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic'
    ): Promise<ImageGenerationResponse> {
      return await this.generateImage({
        prompt: description,
        style,
        size: '1024x1024',
        quality: 'hd',
      });
    }
  
    async generateMedicalIllustrationWithMock(
      description: string,
      style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic',
      mockImagePath?: string
    ): Promise<ImageGenerationResponse> {
      return await this.generateImage({
        prompt: description,
        style,
        size: '1024x1024',
        quality: 'hd',
        mockImagePath,
      });
    }
  }
  
  export function createImagenClientService(userId: string): ImagenClientService {
    return new ImagenClientService(userId);
  }