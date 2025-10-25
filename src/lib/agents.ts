'use client';

import { LangGraphClient } from '@/lib/langgraph-client';
import { ImagenClientService, createImagenClientService } from '@/lib/imagen-client';
import { ImageGenerationResponse } from '@/lib/dalle-service';

export interface AgentResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  needsAuthorization?: boolean;
  authorizationUrl?: string;
  toolName?: string;
}

export class EmailAgent {
  constructor(private userId: string) {}

  async processMessage(message: string): Promise<AgentResponse> {
    const systemPrompt = `You are @email, a mass communication agent for medical professionals. 
    You help with:
    - Template management for patient communications
    - Merge fields (patient name, appointment times, etc.)
    - Scheduling/delayed sending
    - Tracking (opened, clicked)
    - HIPAA-compliant email handling
    
    Always ensure HIPAA compliance in all communications.`;

    try {
      const langGraphClient = await LangGraphClient.forUser(this.userId);
      const response = await langGraphClient.sendMessage([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]);

      return {
        content: response.content,
        toolCalls: response.tool_calls,
        needsAuthorization: response.needsAuthorization,
        authorizationUrl: response.authorizationUrl,
        toolName: response.toolName
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not configured')) {
        return {
          content: `Please configure your Gemini/Replicate API key first to use AI features. Go to Settings to add your API key.`
        };
      }
      return {
        content: `I'm having trouble processing your email request. Please try again or contact support if the issue persists.`
      };
    }
  }
}


export class IllustrationAgent {
  constructor(private userId: string) {}

  async processMessage(message: string): Promise<AgentResponse> {
    try {
      // Create Imagen client service for this user
      const imagenClient = createImagenClientService(this.userId);
      
      // Determine the style based on the message - default to comic style
      const lowerMessage = message.toLowerCase();
      let style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic';
      
      if (lowerMessage.includes('schematic') || lowerMessage.includes('diagram')) {
        style = 'schematic';
      } else if (lowerMessage.includes('patient') || lowerMessage.includes('simple') || lowerMessage.includes('easy')) {
        style = 'patient-friendly';
      } else if (lowerMessage.includes('realistic') || lowerMessage.includes('photorealistic')) {
        style = 'realistic';
      }
      
      // Generate the medical illustration with multiple reference images
      const result = await imagenClient.generateMedicalIllustrationWithMock(message, style, "/public/example.png");
      
      if (result.success && result.imageUrl) {
        let content = `🎨 **Medical Illustration Generated**\n\nI've created a ${style} medical illustration for you.\n\n**Description:** ${message}\n\n**Style:** ${style}`;
        
        // Add panel captions if available
        if (result.panelCaptions) {
          content += `\n\n**Panel Descriptions:**\n${result.panelCaptions}`;
        }
        
        return {
          content,
          toolCalls: [{
            id: 'illustration_generated',
            type: 'image_generation',
            function: {
              name: 'generate_medical_illustration',
              arguments: JSON.stringify({
                imageUrl: result.imageUrl,
                description: message,
                style: style,
                revisedPrompt: result.revisedPrompt,
                panelCaptions: result.panelCaptions
              })
            }
          }]
        };
      } else {
        return {
          content: `❌ **Illustration Generation Failed**\n\nI encountered an error while generating your medical illustration: ${result.error}\n\nPlease try rephrasing your request or contact support if the issue persists.`
        };
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('not configured')) {
        return {
          content: `Please configure your Gemini/Replicate API key first to use AI features. Go to Settings to add your API key.`
        };
      }
      return {
        content: `I'm having trouble processing your illustration request. Please try again or contact support if the issue persists.`
      };
    }
  }

  /**
   * Generate a medical illustration using a mock image reference
   */
  async generateMedicalIllustrationWithMock(
    description: string,
    style: 'realistic' | 'schematic' | 'patient-friendly' | 'comic' = 'comic',
    mockImagePath: string
  ): Promise<ImageGenerationResponse> {
    const imagenClient = createImagenClientService(this.userId);
    return await imagenClient.generateMedicalIllustrationWithMock(
      description,
      style,
      mockImagePath
    );
  }
}

export class AssistantAgent {
  constructor(private userId: string) {}

  async processMessage(message: string): Promise<AgentResponse> {
    const systemPrompt = `You are @assistant, a general medical assistant for medical professionals.
    You help with:
    - Clinical decision support
    - Literature search
    - Documentation help
    - Drug interaction checks
    - General medical queries
    
    Always provide evidence-based information and remind users to verify critical information with current medical guidelines.`;

    try {
      const langGraphClient = await LangGraphClient.forUser(this.userId);
      const response = await langGraphClient.sendMessage([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]);

      return {
        content: response.content,
        toolCalls: response.tool_calls,
        needsAuthorization: response.needsAuthorization,
        authorizationUrl: response.authorizationUrl,
        toolName: response.toolName
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not configured')) {
        return {
          content: `Please configure your Gemini/Replicate API key first to use AI features. Go to Settings to add your API key.`
        };
      }
      return {
        content: `I'm having trouble processing your request. Please try again or contact support if the issue persists.`
      };
    }
  }
}

export function createAgents(userId: string) {
  return {
    email: new EmailAgent(userId),
    illustration: new IllustrationAgent(userId),
    assistant: new AssistantAgent(userId),
  };
}

export async function processMessageWithAgent(agentType: string, message: string, userId: string): Promise<AgentResponse> {
  const agents = createAgents(userId);
  const agent = agents[agentType as keyof typeof agents];
  if (!agent) {
    return {
      content: `Unknown agent type: ${agentType}. Available agents are: email, illustration, assistant.`
    };
  }

  return await agent.processMessage(message);
}
