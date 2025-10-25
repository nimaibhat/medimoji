import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const { userId, to, subject, body } = await request.json();

    if (!userId || !to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, to, subject, body' },
        { status: 400 }
      );
    }

    // Get user's Gmail credentials from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    let gmailCredentials = userData?.gmailCredentials;

    if (!gmailCredentials) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect Gmail in settings.' },
        { status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    if (Date.now() >= gmailCredentials.expires_at) {
      try {
        // Try to refresh the token
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: gmailCredentials.refresh_token,
            user_id: userId
          })
        });

        if (refreshResponse.ok) {
          const newCredentials = await refreshResponse.json();
          gmailCredentials = newCredentials;
          
          // Update the credentials in Firestore
          await adminDb.collection('users').doc(userId).set({
            gmailCredentials: newCredentials,
          }, { merge: true });
        } else {
          const errorData = await refreshResponse.json();
          // Check if it's a revocation error (401) vs other errors
          if (refreshResponse.status === 401) {
            return NextResponse.json(
              { error: 'Gmail access has been revoked. Please reconnect Gmail in settings.' },
              { status: 401 }
            );
          } else {
            return NextResponse.json(
              { error: 'Gmail session expired and refresh failed. Please try again or reconnect Gmail in settings.' },
              { status: 400 }
            );
          }
        }
      } catch (refreshError) {
        console.error('Error refreshing Gmail token:', refreshError);
        return NextResponse.json(
          { error: 'Gmail session expired and refresh failed. Please reconnect Gmail in settings.' },
          { status: 400 }
        );
      }
    }

    // Create Gmail API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials(gmailCredentials);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body.replace(/\n/g, '<br>')
    ].join('\n');

    const encodedMessage = Buffer.from(message).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    return NextResponse.json({
      success: true,
      messageId: result.data.id,
      message: 'Email sent successfully!'
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
