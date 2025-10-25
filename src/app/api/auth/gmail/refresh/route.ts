import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuth } from '@/lib/gmail-oauth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { refresh_token, user_id } = await request.json();

    if (!refresh_token || !user_id) {
      return NextResponse.json(
        { error: 'Refresh token and user ID are required' },
        { status: 400 }
      );
    }

    const gmailOAuth = new GmailOAuth();
    const newCredentials = await gmailOAuth.refreshAccessToken(refresh_token);

    // Update credentials in Firestore using Admin SDK
    await adminDb.collection('users').doc(user_id).set({
      gmailCredentials: newCredentials,
    }, { merge: true });

    return NextResponse.json(newCredentials);
  } catch (error) {
    console.error('Error refreshing Gmail token:', error);
    
    // Check if it's a token revocation error
    if (error instanceof Error && error.message.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Gmail access has been revoked. Please reconnect Gmail in settings.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to refresh access token' },
      { status: 500 }
    );
  }
}
