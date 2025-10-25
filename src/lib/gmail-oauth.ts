import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}

export class GmailOAuth {
  private oauth2Client: OAuth2Client;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback';
    
    this.oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  /**
   * Generate the authorization URL for Gmail OAuth
   */
  getAuthUrl(_userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: _userId, // Include user ID in state for security
      prompt: 'consent' // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string, userId: string): Promise<GmailCredentials> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to get access and refresh tokens');
      }

      const credentials: GmailCredentials = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date || (Date.now() + 3600000), // 1 hour default
        scope: tokens.scope || ''
      };

      return credentials;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GmailCredentials> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      return {
        access_token: credentials.access_token,
        refresh_token: refreshToken, // Keep the same refresh token
        expires_at: credentials.expiry_date || (Date.now() + 3600000),
        scope: credentials.scope || ''
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Create Gmail API client with credentials
   */
  createGmailClient(credentials: GmailCredentials) {
    this.oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token
    });

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Send email using Gmail API
   */
  async sendEmail(credentials: GmailCredentials, to: string, subject: string, body: string) {
    try {
      const gmail = this.createGmailClient(credentials);
      
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        body
      ].join('\n');

      const encodedMessage = Buffer.from(message).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * List emails from Gmail
   */
  async listEmails(credentials: GmailCredentials, maxResults: number = 10) {
    try {
      const gmail = this.createGmailClient(credentials);
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults
      });

      return response.data;
    } catch (error) {
      console.error('Error listing emails:', error);
      throw new Error('Failed to list emails');
    }
  }
}
