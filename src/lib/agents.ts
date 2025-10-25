'use client';

import { LangGraphClient } from '@/lib/langgraph-client';
import { createDALLEService } from '@/lib/dalle-service';

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
          content: `Please configure your OpenAI API key first to use AI features. Go to Settings to add your API key.`
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
      // Create DALL-E service for this user
      const dalleService = await createDALLEService(this.userId);
      
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
      
      // Generate the medical illustration
      const result = await dalleService.generateMedicalIllustration(message, style);
      
      if (result.success && result.imageUrl) {
        return {
          content: `🎨 **Medical Illustration Generated**\n\nI've created a ${style} medical illustration for you.\n\n**Description:** ${message}\n\n**Style:** ${style}`,
          toolCalls: [{
            id: 'illustration_generated',
            type: 'image_generation',
            function: {
              name: 'generate_medical_illustration',
              arguments: JSON.stringify({
                imageUrl: result.imageUrl,
                description: message,
                style: style,
                revisedPrompt: result.revisedPrompt
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
          content: `Please configure your OpenAI API key first to use AI features. Go to Settings to add your API key.`
        };
      }
      return {
        content: `I'm having trouble processing your illustration request. Please try again or contact support if the issue persists.`
      };
    }
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
          content: `Please configure your OpenAI API key first to use AI features. Go to Settings to add your API key.`
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
