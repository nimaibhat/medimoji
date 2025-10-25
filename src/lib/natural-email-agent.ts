import { LangGraphClient } from './langgraph-client';
import { AgentResponse } from './agents';

export interface EmailIntent {
  action: 'send' | 'draft' | 'schedule' | 'template' | 'reminder';
  recipients: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  scheduleTime?: Date;
  templateName?: string;
  mergeFields?: Record<string, string>;
}

export class NaturalEmailAgent {
  private langGraphClient: LangGraphClient;
  private userId: string;

  constructor(langGraphClient: LangGraphClient, userId: string) {
    this.langGraphClient = langGraphClient;
    this.userId = userId;
  }

  async processMessage(message: string): Promise<AgentResponse> {
    const systemPrompt = `You are an intelligent email assistant for medical professionals. You help with natural language email requests.

Your capabilities:
- Send emails to patients, colleagues, or other contacts
- Create email templates and manage merge fields
- Schedule emails for later delivery
- Send appointment reminders and follow-ups
- Handle HIPAA-compliant patient communications

When a user asks you to send an email, extract the following information:
1. Recipients (email addresses)
2. Subject line
3. Email body content
4. Any scheduling requirements
5. Template preferences

Be conversational and helpful. If information is missing, ask clarifying questions in a natural way.

Always ensure HIPAA compliance and professional medical communication standards.`;

    try {
      // First, try to extract email intent using AI
      const emailIntent = await this.extractEmailIntent(message);
      
      if (emailIntent.action === 'send') {
        // Process the email sending
        return await this.processEmailSending(emailIntent, message);
      } else if (emailIntent.action === 'template') {
        // Handle template creation
        return await this.processTemplateCreation(emailIntent, message);
      } else if (emailIntent.action === 'reminder') {
        // Handle reminder creation
        return await this.processReminderCreation(emailIntent, message);
      } else {
        // General email assistance
        return await this.processGeneralEmailRequest(message);
      }
    } catch (error) {
      console.error('Error in natural email processing:', error);
      return {
        content: `I'm having trouble processing your email request. Please try rephrasing your request or contact support if the issue persists.`
      };
    }
  }

  private async extractEmailIntent(message: string): Promise<EmailIntent> {
    const extractionPrompt = `You are an email intent extractor. Analyze the user's message and extract email information.

If the user wants to send an email, extract:
- Recipients (email addresses)
- Subject line (look for quoted text after "subject")
- Email body content (look for quoted text after "body about" or "body")

Examples:
- "Send an email to john@example.com with subject 'meeting' and body about 'we have a meeting right now'" 
  → {"action": "send", "recipients": ["john@example.com"], "subject": "meeting", "body": "we have a meeting right now"}

- "Email jane@example.com about the project update"
  → {"action": "send", "recipients": ["jane@example.com"], "subject": "Project Update", "body": "Hello, I wanted to discuss the project update with you."}

Respond with a JSON object containing the extracted information. Be precise with quoted content extraction.

User message: "${message}"`;

    try {
      const response = await this.langGraphClient.sendMessage([
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: message }
      ]);

      // Try to parse JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and clean the parsed data
        return {
          action: parsed.action || 'send',
          recipients: Array.isArray(parsed.recipients) ? parsed.recipients.filter((r: unknown) => r && typeof r === 'string' && r.trim()) : [],
          subject: parsed.subject || 'No Subject',
          body: parsed.body || message,
          isHtml: parsed.isHtml || false,
          templateName: parsed.templateName,
          mergeFields: parsed.mergeFields || {}
        };
      }
    } catch (error) {
      console.error('Error extracting email intent:', error);
    }

    // Fallback extraction
    return this.fallbackEmailExtraction(message);
  }

  private fallbackEmailExtraction(message: string): EmailIntent {
    const lowerMessage = message.toLowerCase();
    
    // Extract email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const recipients = message.match(emailRegex) || [];

    // Determine action
    let action: EmailIntent['action'] = 'send';
    if (lowerMessage.includes('template') || lowerMessage.includes('create')) {
      action = 'template';
    } else if (lowerMessage.includes('reminder') || lowerMessage.includes('remind')) {
      action = 'reminder';
    } else if (lowerMessage.includes('schedule') || lowerMessage.includes('later')) {
      action = 'schedule';
    }

    // Extract subject - look for various patterns
    let subject = 'No Subject';
    const subjectPatterns = [
      /subject[:\s]+['"]([^'"]+)['"]/i,
      /about[:\s]+['"]([^'"]+)['"]/i,
      /regarding[:\s]+['"]([^'"]+)['"]/i,
      /re[:\s]+['"]([^'"]+)['"]/i,
      // Look for "about" without quotes
      /about\s+([^,.\n]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/i,
      // Look for "regarding" without quotes
      /regarding\s+([^,.\n]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/i
    ];

    for (const pattern of subjectPatterns) {
      const match = message.match(pattern);
      if (match && match[1].trim()) {
        subject = match[1].trim();
        break;
      }
    }

    // If no explicit subject found, try to generate one from context
    if (subject === 'No Subject') {
      if (lowerMessage.includes('meeting')) {
        subject = 'Meeting Discussion';
      } else if (lowerMessage.includes('appointment')) {
        subject = 'Appointment Information';
      } else if (lowerMessage.includes('reminder')) {
        subject = 'Reminder';
      } else if (lowerMessage.includes('follow up') || lowerMessage.includes('follow-up')) {
        subject = 'Follow Up';
      } else if (lowerMessage.includes('update')) {
        subject = 'Update';
      } else if (lowerMessage.includes('question')) {
        subject = 'Question';
      } else {
        subject = 'Message from Medimoji';
      }
    }

    // Extract body - clean up the message
    let body = message;
    
    // First, try to extract body from explicit patterns
    const bodyPatterns = [
      /and\s+a\s+body\s+about\s+['"]([^'"]+)['"]/gi,
      /and\s+body\s+about\s+['"]([^'"]+)['"]/gi,
      /with\s+a\s+body\s+about\s+['"]([^'"]+)['"]/gi,
      /with\s+body\s+about\s+['"]([^'"]+)['"]/gi,
      /body\s+about\s+['"]([^'"]+)['"]/gi,
      /and\s+a\s+body\s+['"]([^'"]+)['"]/gi,
      /and\s+body\s+['"]([^'"]+)['"]/gi,
      /with\s+a\s+body\s+['"]([^'"]+)['"]/gi,
      /with\s+body\s+['"]([^'"]+)['"]/gi,
      /body\s+['"]([^'"]+)['"]/gi,
      /saying\s+['"]([^'"]+)['"]/gi,
      /that\s+says\s+['"]([^'"]+)['"]/gi,
      /about\s+['"]([^'"]+)['"]/gi
    ];
    
    let extractedBody = '';
    for (const pattern of bodyPatterns) {
      const match = body.match(pattern);
      if (match && match[1] && match[1].trim()) {
        extractedBody = match[1].trim();
        break;
      }
    }
    
    if (extractedBody) {
      body = extractedBody;
    } else {
      // Remove common email phrases and command structures
      body = body.replace(/@email\s+/gi, '');
      body = body.replace(/send\s+(an?\s+)?email\s+to/gi, '');
      body = body.replace(/email\s+to/gi, '');
      body = body.replace(/send\s+to/gi, '');
      body = body.replace(/with\s+a\s+subject\s+['"][^'"]+['"]/gi, '');
      body = body.replace(/subject[:\s]+['"][^'"]+['"]/gi, '');
      body = body.replace(/about[:\s]+['"][^'"]+['"]/gi, '');
      body = body.replace(/regarding[:\s]+['"][^'"]+['"]/gi, '');
      body = body.replace(/about\s+([^,.\n]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/gi, '');
      body = body.replace(/regarding\s+([^,.\n]+?)(?:\s+and\s+body|\s+with\s+body|\s+message|$)/gi, '');
      body = body.replace(/with\s+a\s+and\s+a\s+body/gi, '');
      body = body.replace(/and\s+a\s+body/gi, '');
      body = body.replace(/with\s+body/gi, '');
      body = body.replace(/send\s+the\s+email\s+now/gi, '');
      body = body.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, ''); // Remove email addresses
      body = body.replace(/please/gi, '');
      body = body.replace(/can\s+you/gi, '');
      body = body.replace(/could\s+you/gi, '');
      body = body.replace(/would\s+you/gi, '');
      body = body.replace(/\s+/g, ' ').trim();
    }

    // If body is too short, use a default
    if (body.length < 5) {
      body = "Hello,\n\nI wanted to reach out to you.\n\nBest regards";
    }

    return {
      action,
      recipients,
      subject,
      body,
      isHtml: false
    };
  }

  private async processEmailSending(intent: EmailIntent, originalMessage: string): Promise<AgentResponse> {
    // Check if we have valid recipients
    if (intent.recipients.length === 0 || intent.recipients.some(r => !r || r.trim() === '')) {
      return {
        content: `I'd be happy to help you send an email! I need to know who to send it to. Please provide the email address(es) of the recipient(s).\n\nExample: "Send an email to john@example.com about the meeting tomorrow"`
      };
    }

    // Validate email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const validRecipients = intent.recipients.filter(email => emailRegex.test(email));
    
    if (validRecipients.length === 0) {
      return {
        content: `I couldn't find valid email addresses in your request. Please provide proper email addresses.\n\nExample: "Send an email to john@example.com about the meeting tomorrow"`
      };
    }

    // Use the original message as body if no proper body was extracted
    let emailBody = intent.body;
    if (!emailBody || emailBody.length < 10 || emailBody === originalMessage) {
      // Try to extract a meaningful body from the original message
      emailBody = this.extractEmailBodyFromMessage(originalMessage);
    }

    // Generate a subject if none provided
    let emailSubject = intent.subject;
    if (!emailSubject || emailSubject === 'No Subject') {
      emailSubject = this.generateSubjectFromMessage(originalMessage);
    }

    // Check if Gmail access is available
    if (!this.langGraphClient['gmailCredentials'] || this.langGraphClient['isTokenExpired']()) {
      return {
        content: 'To send emails, I need access to your Gmail account. Please authorize Gmail access in your settings first.',
        needsAuthorization: true,
        authorizationUrl: '/api/auth/gmail',
        toolName: 'Gmail'
      };
    }

    try {
      // Send the email via the existing Gmail API
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          to: validRecipients.join(','),
          subject: emailSubject,
          body: emailBody,
          isHtml: intent.isHtml || false
        })
      });

      const result = await response.json();
      
      if (result.success) {
        return {
          content: `✅ Email sent successfully!\n\n**To:** ${intent.recipients.join(', ')}\n**Subject:** ${intent.subject}\n**Message ID:** ${result.messageId}\n\nYour message has been delivered.`
        };
      } else {
        return {
          content: `❌ Failed to send email: ${result.error}\n\nPlease check the recipient email addresses and try again.`
        };
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        content: `❌ Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`
      };
    }
  }

  private async processTemplateCreation(intent: EmailIntent, originalMessage: string): Promise<AgentResponse> {
    const templatePrompt = `Create a professional email template for medical communications. The template should be HIPAA-compliant and professional.

Template name: ${intent.templateName || 'Email Template'}
Template content: ${intent.body}

Please format this as a proper email template with merge fields in [BRACKET_CAPS] format for personalization.`;

    try {
      const response = await this.langGraphClient.sendMessage([
        { role: 'system', content: templatePrompt },
        { role: 'user', content: originalMessage }
      ]);

      return {
        content: `📧 **Email Template Created**\n\n${response.content}\n\n*This template can be reused for similar communications. Remember to replace the merge fields with actual patient information.*`
      };
    } catch (error) {
      return {
        content: `I can help you create email templates! Please describe what type of template you need (e.g., appointment reminders, follow-ups, general communications).`
      };
    }
  }

  private async processReminderCreation(intent: EmailIntent, originalMessage: string): Promise<AgentResponse> {
    return {
      content: `🔔 **Reminder System**\n\nI can help you set up appointment reminders! For now, I can send immediate reminder emails. To set up scheduled reminders, please specify:\n\n• Who should receive the reminder\n• What the reminder is about\n• When it should be sent\n\nWould you like me to send a reminder email now?`
    };
  }

  private async processGeneralEmailRequest(message: string): Promise<AgentResponse> {
    const response = await this.langGraphClient.sendMessage([
      { role: 'system', content: 'You are a helpful email assistant for medical professionals. Provide helpful guidance about email communications, templates, and best practices.' },
      { role: 'user', content: message }
    ]);

    return {
      content: response.content
    };
  }

  private extractEmailBodyFromMessage(message: string): string {
    // Remove common email-related phrases and extract the core message
    let body = message
      .replace(/send\s+(an?\s+)?email\s+to/gi, '')
      .replace(/email\s+to/gi, '')
      .replace(/send\s+to/gi, '')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '') // Remove email addresses
      .replace(/about\s+['"]([^'"]+)['"]/gi, '') // Remove "about 'subject'"
      .replace(/subject[:\s]+['"]([^'"]+)['"]/gi, '') // Remove subject lines
      .replace(/with\s+subject[:\s]+['"]([^'"]+)['"]/gi, '') // Remove "with subject"
      .replace(/regarding[:\s]+['"]([^'"]+)['"]/gi, '') // Remove "regarding"
      .replace(/please/gi, '')
      .replace(/can\s+you/gi, '')
      .replace(/could\s+you/gi, '')
      .replace(/would\s+you/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If the body is too short or empty, use a default message
    if (body.length < 5) {
      body = "Hello,\n\nI wanted to reach out to you.\n\nBest regards";
    }

    return body;
  }

  private generateSubjectFromMessage(message: string): string {
    // Try to extract a meaningful subject from the message
    const lowerMessage = message.toLowerCase();
    
    // Look for common subject patterns
    const subjectPatterns = [
      /about\s+['"]([^'"]+)['"]/i,
      /subject[:\s]+['"]([^'"]+)['"]/i,
      /regarding[:\s]+['"]([^'"]+)['"]/i,
      /re[:\s]+['"]([^'"]+)['"]/i
    ];

    for (const pattern of subjectPatterns) {
      const match = message.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    // Generate subject based on content
    if (lowerMessage.includes('meeting')) {
      return 'Meeting Discussion';
    } else if (lowerMessage.includes('appointment')) {
      return 'Appointment Information';
    } else if (lowerMessage.includes('reminder')) {
      return 'Reminder';
    } else if (lowerMessage.includes('follow up') || lowerMessage.includes('follow-up')) {
      return 'Follow Up';
    } else if (lowerMessage.includes('update')) {
      return 'Update';
    } else if (lowerMessage.includes('question')) {
      return 'Question';
    } else {
      return 'Message from Medimoji';
    }
  }
}

export async function createNaturalEmailAgent(userId: string): Promise<NaturalEmailAgent> {
  const langGraphClient = await LangGraphClient.forUser(userId);
  return new NaturalEmailAgent(langGraphClient, userId);
}
