import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
// LangGraph imports for future use
// import { StateGraph, END } from '@langchain/langgraph';

export interface LangGraphMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface LangGraphResponse {
  content: string;
  tool_calls?: Array<{
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

export interface GmailCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class LangGraphClient {
  private openai: ChatOpenAI;
  private userId: string;
  private gmailCredentials?: GmailCredentials;

  constructor(apiKey: string, userId: string, gmailCredentials?: GmailCredentials) {
    this.openai = new ChatOpenAI({
      apiKey,
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });
    this.userId = userId;
    this.gmailCredentials = gmailCredentials;
  }

  /**
   * Create LangGraphClient for a specific user
   */
  static async forUser(userId: string): Promise<LangGraphClient> {
    const { db } = await import('./firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    const openaiApiKey = userData.openaiApiKey || process.env.OPENAI_API_KEY;
    const gmailCredentials = userData.gmailCredentials;
    
    if (!openaiApiKey) {
      throw new Error('User has not configured their OpenAI API key. Please add your OpenAI API key in settings.');
    }
    
    return new LangGraphClient(openaiApiKey, userId, gmailCredentials);
  }

  async sendMessage(messages: LangGraphMessage[]): Promise<LangGraphResponse> {
    try {
      // Convert messages to LangChain format
      const langchainMessages = messages.map(msg => {
        switch (msg.role) {
          case 'user':
            return new HumanMessage(msg.content);
          case 'assistant':
            return new AIMessage(msg.content);
          case 'system':
            return new SystemMessage(msg.content);
          default:
            return new HumanMessage(msg.content);
        }
      });

      // For now, we'll use a simple approach with OpenAI
      // In the future, we can implement more complex LangGraph workflows
      const response = await this.openai.invoke(langchainMessages);
      
      // Check if the response contains tool calls or requests for Gmail access
      const content = response.content as string;
      
      // Simple keyword detection for Gmail operations
      if (this.needsGmailAccess(content)) {
        if (!this.gmailCredentials || this.isTokenExpired()) {
          return {
            content: 'This operation requires Gmail access. Please authorize Gmail in your settings.',
            needsAuthorization: true,
            authorizationUrl: '/api/auth/gmail',
            toolName: 'Gmail'
          };
        }
        
        // Execute Gmail operations via API
        try {
          // Parse the email request from the content
          const emailRequest = this.parseEmailRequest(content);
          if (emailRequest) {
            const response = await fetch('/api/gmail/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: this.userId,
                to: emailRequest.to,
                subject: emailRequest.subject,
                body: emailRequest.body
              })
            });

            const result = await response.json();
            
            if (result.success) {
              return {
                content: `✅ Email sent successfully!\n\nTo: ${emailRequest.to}\nSubject: ${emailRequest.subject}\n\nMessage ID: ${result.messageId}`,
                tool_calls: []
              };
            } else {
              return {
                content: `❌ Failed to send email: ${result.error}`,
                tool_calls: []
              };
            }
          } else {
            // If we can't parse a specific email request, just confirm Gmail is available
            return {
              content: '✅ Gmail is connected and ready! I can help you send emails. Try saying something like "Send an email to john@example.com with subject \'Meeting Reminder\' and body \'Don\'t forget about our meeting tomorrow at 2 PM.\'"',
              tool_calls: []
            };
          }
        } catch (error) {
          console.error('Gmail operation error:', error);
          return {
            content: `❌ Gmail operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            tool_calls: []
          };
        }
      }

      return {
        content: content || 'No response generated',
        tool_calls: []
      };

    } catch (error) {
      console.error('LangGraph API error:', error);
      return {
        content: `I'm having trouble processing your request. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for more details.`
      };
    }
  }

  private needsGmailAccess(content: string): boolean {
    const gmailKeywords = [
      'send email', 'email', 'gmail', 'compose', 'draft', 'inbox',
      'send message', 'email reminder', 'patient email'
    ];
    
    return gmailKeywords.some(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isTokenExpired(): boolean {
    if (!this.gmailCredentials) return true;
    return Date.now() >= this.gmailCredentials.expires_at;
  }

  private parseEmailRequest(content: string): EmailMessage | null {
    // Find email address
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = content.match(emailRegex);
    
    if (!emailMatch) return null;

    const to = emailMatch[0];
    let subject = 'No Subject';
    let body = 'No message content';

    // More flexible parsing approach
    const lowerContent = content.toLowerCase();
    
    // Extract subject - look for various patterns
    const subjectPatterns = [
      // "subject: 'text'" or "subject: text"
      /subject[:\s]+['"]([^'"]+)['"]/i,
      /subject[:\s]+([^\n\r]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/i,
      // "with subject 'text'" or "with subject text"
      /with\s+subject[:\s]+['"]([^'"]+)['"]/i,
      /with\s+subject[:\s]+([^\n\r]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/i,
      // "about 'text'" or "about text"
      /about[:\s]+['"]([^'"]+)['"]/i,
      /about[:\s]+([^\n\r]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/i,
      // "regarding 'text'" or "regarding text"
      /regarding[:\s]+['"]([^'"]+)['"]/i,
      /regarding[:\s]+([^\n\r]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/i
    ];
    
    for (const pattern of subjectPatterns) {
      const match = content.match(pattern);
      if (match && match[1].trim().length > 0) {
        subject = match[1].trim();
        break;
      }
    }

    // Extract body - look for various patterns
    const bodyPatterns = [
      // "body: 'text'" or "body: text"
      /body[:\s]+['"]([^'"]+)['"]/i,
      /body[:\s]+([^\n\r]+)/i,
      // "and body 'text'" or "and body text"
      /and\s+body[:\s]+['"]([^'"]+)['"]/i,
      /and\s+body[:\s]+([^\n\r]+)/i,
      // "with body 'text'" or "with body text"
      /with\s+body[:\s]+['"]([^'"]+)['"]/i,
      /with\s+body[:\s]+([^\n\r]+)/i,
      // "message: 'text'" or "message: text"
      /message[:\s]+['"]([^'"]+)['"]/i,
      /message[:\s]+([^\n\r]+)/i,
      // "saying 'text'" or "saying text"
      /saying[:\s]+['"]([^'"]+)['"]/i,
      /saying[:\s]+([^\n\r]+)/i,
      // "that says 'text'" or "that says text"
      /that\s+says[:\s]+['"]([^'"]+)['"]/i,
      /that\s+says[:\s]+([^\n\r]+)/i
    ];
    
    for (const pattern of bodyPatterns) {
      const match = content.match(pattern);
      if (match && match[1].trim().length > 0) {
        body = match[1].trim();
        break;
      }
    }

    // If no explicit body found, try to extract from the end of the message
    if (body === 'No message content') {
      // Remove common email-related phrases and extract remaining content
      const cleanedContent = content
        .replace(emailRegex, '') // Remove email
        .replace(/send\s+(an?\s+)?email\s+to/gi, '') // Remove "send email to"
        .replace(/email\s+to/gi, '') // Remove "email to"
        .replace(/subject[:\s]+['"][^'"]+['"]/gi, '') // Remove subject with quotes
        .replace(/subject[:\s]+[^\n\r]+/gi, '') // Remove subject without quotes
        .replace(/with\s+subject[:\s]+['"][^'"]+['"]/gi, '') // Remove "with subject"
        .replace(/with\s+subject[:\s]+[^\n\r]+/gi, '') // Remove "with subject"
        .replace(/about[:\s]+['"][^'"]+['"]/gi, '') // Remove "about"
        .replace(/about[:\s]+[^\n\r]+/gi, '') // Remove "about"
        .replace(/regarding[:\s]+['"][^'"]+['"]/gi, '') // Remove "regarding"
        .replace(/regarding[:\s]+[^\n\r]+/gi, '') // Remove "regarding"
        .replace(/and\s+body[:\s]+['"][^'"]+['"]/gi, '') // Remove "and body"
        .replace(/and\s+body[:\s]+[^\n\r]+/gi, '') // Remove "and body"
        .replace(/with\s+body[:\s]+['"][^'"]+['"]/gi, '') // Remove "with body"
        .replace(/with\s+body[:\s]+[^\n\r]+/gi, '') // Remove "with body"
        .replace(/message[:\s]+['"][^'"]+['"]/gi, '') // Remove "message"
        .replace(/message[:\s]+[^\n\r]+/gi, '') // Remove "message"
        .replace(/saying[:\s]+['"][^'"]+['"]/gi, '') // Remove "saying"
        .replace(/saying[:\s]+[^\n\r]+/gi, '') // Remove "saying"
        .replace(/that\s+says[:\s]+['"][^'"]+['"]/gi, '') // Remove "that says"
        .replace(/that\s+says[:\s]+[^\n\r]+/gi, '') // Remove "that says"
        .replace(/please/gi, '') // Remove "please"
        .replace(/can\s+you/gi, '') // Remove "can you"
        .replace(/could\s+you/gi, '') // Remove "could you"
        .replace(/would\s+you/gi, '') // Remove "would you"
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (cleanedContent && cleanedContent.length > 5) {
        body = cleanedContent;
      }
    }

    // If still no body, try to extract from quoted text
    if (body === 'No message content') {
      const quotedText = content.match(/['"]([^'"]+)['"]/g);
      if (quotedText && quotedText.length > 0) {
        // Use the last quoted text as body if it's not the subject
        const lastQuote = quotedText[quotedText.length - 1].slice(1, -1);
        if (lastQuote !== subject && lastQuote.length > 5) {
          body = lastQuote;
        }
      }
    }

    return {
      to,
      subject,
      body: body.replace(/\n/g, '<br>'), // Convert newlines to HTML
      isHtml: true
    };
  }

  async refreshGmailToken(): Promise<boolean> {
    if (!this.gmailCredentials?.refresh_token) return false;
    
    try {
      const response = await fetch('/api/auth/gmail/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: this.gmailCredentials.refresh_token,
          user_id: this.userId
        })
      });
      
      if (response.ok) {
        const newCredentials = await response.json();
        this.gmailCredentials = newCredentials;
        return true;
      }
    } catch (error) {
      console.error('Error refreshing Gmail token:', error);
    }
    
    return false;
  }
}

// Legacy fallback for development/testing
export const langGraphClient = new LangGraphClient(
  process.env.OPENAI_API_KEY || '', 
  'default-user'
);
