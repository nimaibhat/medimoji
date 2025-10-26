import { LangGraphClient } from './langgraph-client';
import { ImagenClientService } from './imagen-client';
import { AgentResponse } from './agents';

export interface IllustrationIntent {
  type: 'anatomical' | 'surgical' | 'general' | 'educational';
  description: string;
  style: 'realistic' | 'schematic' | 'patient-friendly' | 'anatomical';
  bodyPart?: string;
  procedure?: string;
  annotations?: boolean;
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
    const systemPrompt = `You are a medical illustration assistant specializing in patient communication materials. You create clear, compassionate visual aids that help healthcare providers communicate with diverse patient populations, including those with language barriers, low literacy, or communication differences.

Your purpose:
- Support informed consent and patient understanding through visual communication
- Create culturally sensitive, universally understandable medical illustrations
- Bridge communication gaps between healthcare providers and patients
- Ensure dignity and clarity in medical education materials

Your capabilities:
- Generate anatomical diagrams with clear visual progression
- Create procedure illustrations showing step-by-step processes
- Design patient education materials using visual storytelling
- Produce medical visual aids that transcend language barriers
- Balance medical accuracy with accessibility and respect

Guidelines:
- Use NO TEXT in illustrations - rely entirely on visual elements
- Utilize muliple panels to illustrate the concept or procedure.\
- Maintain medical accuracy while ensuring clarity
- Use a warm, approachable illustration style that reduces anxiety
- Organize complex information into sequential panels when helpful
- Respect patient dignity in all depictions

When creating illustrations:
1. Identify the medical concept or procedure to communicate
2. Determine the most effective visual approach (anatomical, sequential, comparative)
3. Break complex processes into clear, logical visual steps
4. Ensure illustrations are culturally appropriate and universally comprehensible

Your goal is to empower patients through clear, respectful visual communication that supports their right to understand their own healthcare.`;

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

  private async extractIllustrationIntent(message: string): Promise<IllustrationIntent> {
    const extractionPrompt = `Analyze this medical illustration request and extract the key information.

Extract:
- Type: anatomical, surgical, general, educational
- Description: what should be illustrated
- Style: realistic, schematic, patient-friendly, anatomical
- Body part (if anatomical)
- Procedure (if surgical)

Examples:
- "Draw a heart diagram" → {"type": "anatomical", "description": "heart diagram", "style": "anatomical", "bodyPart": "heart"}
- "Create a surgical procedure for appendectomy" → {"type": "surgical", "description": "appendectomy surgical procedure", "style": "schematic", "procedure": "appendectomy"}
- "Make a patient-friendly diagram of diabetes" → {"type": "educational", "description": "diabetes diagram", "style": "patient-friendly"}

User request: "${message}"`;

    try {
      const response = await this.langGraphClient.sendMessage([
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: message }
      ]);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'general',
          description: parsed.description || message,
          style: parsed.style || 'realistic',
          bodyPart: parsed.bodyPart,
          procedure: parsed.procedure,
          annotations: parsed.annotations || false
        };
      }
    } catch (error) {
      console.error('Error extracting illustration intent:', error);
    }

    // Fallback extraction
    return this.fallbackIllustrationExtraction(message);
  }

  private fallbackIllustrationExtraction(message: string): IllustrationIntent {
    const lowerMessage = message.toLowerCase();
    
    let type: IllustrationIntent['type'] = 'general';
    let style: IllustrationIntent['style'] = 'realistic';
    
    // Determine type
    if (lowerMessage.includes('anatomy') || lowerMessage.includes('anatomical') || lowerMessage.includes('organ')) {
      type = 'anatomical';
    } else if (lowerMessage.includes('surgery') || lowerMessage.includes('surgical') || lowerMessage.includes('procedure')) {
      type = 'surgical';
    } else if (lowerMessage.includes('patient') || lowerMessage.includes('education') || lowerMessage.includes('explain')) {
      type = 'educational';
    }
    
    // Determine style
    if (lowerMessage.includes('schematic') || lowerMessage.includes('diagram')) {
      style = 'schematic';
    } else if (lowerMessage.includes('patient') || lowerMessage.includes('simple') || lowerMessage.includes('easy')) {
      style = 'patient-friendly';
    } else if (lowerMessage.includes('anatomical') || lowerMessage.includes('detailed')) {
      style = 'anatomical';
    }
    
    return {
      type,
      description: message,
      style,
      annotations: lowerMessage.includes('label') || lowerMessage.includes('annotate')
    };
  }

  private async generateIllustration(intent: IllustrationIntent): Promise<{ success: boolean; imageUrl?: string; revisedPrompt?: string; error?: string }> {
    try {
      switch (intent.type) {
        case 'anatomical':
          if (intent.bodyPart) {
            return await this.imagenClient.generateMedicalIllustration(intent.bodyPart, 'realistic');
          } else {
            return await this.imagenClient.generateMedicalIllustration(intent.description, 'realistic');
          }
        
        case 'surgical':
          return await this.imagenClient.generateMedicalIllustration(intent.description, 'comic');
        
        case 'educational':
          return await this.imagenClient.generateMedicalIllustration(intent.description, 'comic');
        
        default:
          return await this.imagenClient.generateMedicalIllustration(intent.description, 'realistic');
      }
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