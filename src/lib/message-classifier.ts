import { LangGraphClient } from './langgraph-client';

export interface MessageClassification {
  agent: 'email' | 'illustration' | 'assistant';
  confidence: number;
  reasoning: string;
  extractedIntent?: {
    type: 'send_email' | 'create_visualization' | 'analyze_data' | 'general_query';
    details?: Record<string, unknown>;
  };
}

export class MessageClassifier {
  private langGraphClient: LangGraphClient;

  constructor(langGraphClient: LangGraphClient) {
    this.langGraphClient = langGraphClient;
  }

  async classifyMessage(message: string): Promise<MessageClassification> {
    const classificationPrompt = `You are a message classifier for a medical AI assistant. Analyze the user's message and determine which specialized agent should handle it.

Available agents:
- email: For sending emails, patient communications, reminders, mass communications
- illustration: For creating medical diagrams, illustrations, visual aids
- assistant: For general medical queries, clinical support, documentation help

Classify the following message and respond with a JSON object containing:
{
  "agent": "email|illustration|assistant",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why this agent was chosen",
  "extractedIntent": {
    "type": "send_email|create_visualization|analyze_data|general_query",
    "details": {} // any relevant extracted information
  }
}

Message to classify: "${message}"`;

    try {
      const response = await this.langGraphClient.sendMessage([
        { role: 'system', content: classificationPrompt },
        { role: 'user', content: message }
      ]);

      // Parse the JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const classification = JSON.parse(jsonMatch[0]);
        return {
          agent: classification.agent,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          extractedIntent: classification.extractedIntent
        };
      } else {
        // Fallback classification based on keywords
        return this.fallbackClassification(message);
      }
    } catch (error) {
      console.error('Error in message classification:', error);
      return this.fallbackClassification(message);
    }
  }

  private fallbackClassification(message: string): MessageClassification {
    const lowerMessage = message.toLowerCase();

    // Email-related keywords
    const emailKeywords = [
      'send email', 'email', 'gmail', 'compose', 'draft', 'inbox',
      'send message', 'email reminder', 'patient email', 'reminder',
      'notify', 'notification', 'contact', 'reach out', 'follow up'
    ];


    // Illustration-related keywords
    const illustrationKeywords = [
      'diagram', 'illustration', 'image', 'picture', 'visual', 'draw',
      'sketch', 'anatomy', 'medical image', 'chart', 'figure'
    ];

    // Count keyword matches
    const emailScore = emailKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;


    const illustrationScore = illustrationKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;

    // Determine the best match
    const scores = [
      { agent: 'email' as const, score: emailScore },
      { agent: 'illustration' as const, score: illustrationScore }
    ];

    const bestMatch = scores.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );

    if (bestMatch.score > 0) {
      return {
        agent: bestMatch.agent,
        confidence: Math.min(bestMatch.score / 3, 0.8), // Cap at 0.8 for fallback
        reasoning: `Matched ${bestMatch.score} keywords related to ${bestMatch.agent}`,
        extractedIntent: this.extractIntentFromMessage(message, bestMatch.agent)
      };
    }

    // Default to assistant for general queries
    return {
      agent: 'assistant',
      confidence: 0.5,
      reasoning: 'No specific keywords detected, routing to general assistant',
      extractedIntent: {
        type: 'general_query',
        details: { originalMessage: message }
      }
    };
  }

  private extractIntentFromMessage(message: string, agent: string): {
    type: 'send_email' | 'create_visualization' | 'analyze_data' | 'general_query';
    details?: Record<string, unknown>;
  } {
    switch (agent) {
      case 'email':
        return this.extractEmailIntent(message);
      case 'illustration':
        return this.extractIllustrationIntent(message);
      default:
        return { type: 'general_query', details: { originalMessage: message } };
    }
  }

  private extractEmailIntent(message: string): {
    type: 'send_email' | 'create_visualization' | 'analyze_data' | 'general_query';
    details?: Record<string, unknown>;
  } {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = message.match(emailRegex);
    
    return {
      type: 'send_email',
      details: {
        hasEmail: !!emailMatch,
        email: emailMatch ? emailMatch[0] : null,
        originalMessage: message
      }
    };
  }


  private extractIllustrationIntent(message: string): {
    type: 'send_email' | 'create_visualization' | 'analyze_data' | 'general_query';
    details?: Record<string, unknown>;
  } {
    return {
      type: 'create_visualization',
      details: {
        originalMessage: message,
        requestedType: this.detectIllustrationType(message)
      }
    };
  }

  private detectVisualizationType(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('chart') || lowerMessage.includes('graph')) {
      if (lowerMessage.includes('bar')) return 'bar_chart';
      if (lowerMessage.includes('line')) return 'line_chart';
      if (lowerMessage.includes('pie')) return 'pie_chart';
      return 'chart';
    }
    
    if (lowerMessage.includes('timeline')) return 'timeline';
    if (lowerMessage.includes('heatmap')) return 'heatmap';
    if (lowerMessage.includes('scatter')) return 'scatter_plot';
    
    return 'general_visualization';
  }

  private detectIllustrationType(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('anatomy') || lowerMessage.includes('anatomical')) {
      return 'anatomical_diagram';
    }
    if (lowerMessage.includes('surgery') || lowerMessage.includes('surgical')) {
      return 'surgical_procedure';
    }
    if (lowerMessage.includes('organ')) {
      return 'organ_diagram';
    }
    if (lowerMessage.includes('bone') || lowerMessage.includes('skeletal')) {
      return 'skeletal_diagram';
    }
    
    return 'medical_illustration';
  }
}

export async function createMessageClassifier(userId: string): Promise<MessageClassifier> {
  const langGraphClient = await LangGraphClient.forUser(userId);
  return new MessageClassifier(langGraphClient);
}
