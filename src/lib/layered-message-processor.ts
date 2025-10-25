import { MessageClassifier, createMessageClassifier } from './message-classifier';
import { NaturalEmailAgent, createNaturalEmailAgent } from './natural-email-agent';
import { NaturalIllustrationAgent, createNaturalIllustrationAgent } from './natural-illustration-agent';
import { processMessageWithAgent } from './agents';
import { AgentResponse } from './agents';

export interface LayeredResponse extends AgentResponse {
  classification?: {
    agent: string;
    confidence: number;
    reasoning: string;
  };
  processingTime?: number;
}

export class LayeredMessageProcessor {
  private messageClassifier: MessageClassifier;
  private naturalEmailAgent: NaturalEmailAgent;
  private naturalIllustrationAgent: NaturalIllustrationAgent;
  private userId: string;

  constructor(
    messageClassifier: MessageClassifier,
    naturalEmailAgent: NaturalEmailAgent,
    naturalIllustrationAgent: NaturalIllustrationAgent,
    userId: string
  ) {
    this.messageClassifier = messageClassifier;
    this.naturalEmailAgent = naturalEmailAgent;
    this.naturalIllustrationAgent = naturalIllustrationAgent;
    this.userId = userId;
  }

  async processMessage(message: string, selectedAgent?: string): Promise<LayeredResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Classify the message to determine the best agent
      const classification = await this.messageClassifier.classifyMessage(message);
      
      // Step 2: Determine which agent to use
      // Prioritize classification if confidence is high (>0.7), otherwise use selectedAgent
      const agentToUse = (classification.confidence > 0.7) ? classification.agent : (selectedAgent || classification.agent);
      
      
      // Step 3: Route to appropriate agent based on classification
      let response: AgentResponse;

      if (agentToUse === 'email') {
        // Use the natural email agent for better email handling
        response = await this.naturalEmailAgent.processMessage(message);
      } else if (agentToUse === 'illustration') {
        // Use the natural illustration agent for image generation
        if (this.naturalIllustrationAgent) {
          response = await this.naturalIllustrationAgent.processMessage(message);
        } else {
          // Fallback to regular agent if illustration agent failed to initialize
          response = await processMessageWithAgent(agentToUse, message, this.userId);
        }
      } else {
        // Use the existing agent system for other types
        response = await processMessageWithAgent(agentToUse, message, this.userId);
      }

      const processingTime = Date.now() - startTime;

      return {
        ...response,
        classification: {
          agent: classification.agent,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        },
        processingTime
      };

    } catch (error) {
      console.error('Error in layered message processing:', error);
      
      const processingTime = Date.now() - startTime;
      
      return {
        content: `I'm having trouble processing your request. Please try again or contact support if the issue persists.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      };
    }
  }

  async processMessageWithOverride(
    message: string, 
    forceAgent?: string
  ): Promise<LayeredResponse> {
    const startTime = Date.now();

    try {
      let response: AgentResponse;

      if (forceAgent === 'email') {
        // Use natural email agent
        response = await this.naturalEmailAgent.processMessage(message);
      } else if (forceAgent === 'illustration') {
        // Use natural illustration agent
        if (this.naturalIllustrationAgent) {
          response = await this.naturalIllustrationAgent.processMessage(message);
        } else {
          // Fallback to regular agent if illustration agent failed to initialize
          response = await processMessageWithAgent(forceAgent, message, this.userId);
        }
      } else if (forceAgent) {
        // Use specified agent
        response = await processMessageWithAgent(forceAgent, message, this.userId);
      } else {
        // Use classification-based routing
        return await this.processMessage(message);
      }

      const processingTime = Date.now() - startTime;

      return {
        ...response,
        processingTime
      };

    } catch (error) {
      console.error('Error in override message processing:', error);
      
      const processingTime = Date.now() - startTime;
      
      return {
        content: `I'm having trouble processing your request. Please try again or contact support if the issue persists.`,
        processingTime
      };
    }
  }
}

export async function createLayeredMessageProcessor(userId: string): Promise<LayeredMessageProcessor> {
  try {
    const messageClassifier = await createMessageClassifier(userId);
    const naturalEmailAgent = await createNaturalEmailAgent(userId);
    
    // Try to create illustration agent, but don't fail if it doesn't work
    let naturalIllustrationAgent;
    try {
      naturalIllustrationAgent = await createNaturalIllustrationAgent(userId);
    } catch (error) {
      console.warn('Failed to create illustration agent:', error);
      // Create a fallback illustration agent
      naturalIllustrationAgent = null as unknown as NaturalIllustrationAgent;
    }
    
    return new LayeredMessageProcessor(messageClassifier, naturalEmailAgent, naturalIllustrationAgent, userId);
  } catch (error) {
    console.error('Error creating layered message processor:', error);
    throw error;
  }
}

// Convenience function for backward compatibility
export async function processMessageWithLayeredAgent(
  message: string, 
  userId: string, 
  selectedAgent?: string
): Promise<LayeredResponse> {
  const processor = await createLayeredMessageProcessor(userId);
  return await processor.processMessage(message, selectedAgent);
}
