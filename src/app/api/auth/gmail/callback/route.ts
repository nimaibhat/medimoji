import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuth } from '@/lib/gmail-oauth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This should contain the userId
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=gmail_auth_failed`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=missing_parameters`
      );
    }

    const gmailOAuth = new GmailOAuth();
    const credentials = await gmailOAuth.getTokens(code, state);

    // Store credentials in Firestore using Admin SDK
    await adminDb.collection('users').doc(state).set({
      gmailCredentials: credentials,
      gmailConnected: true,
      gmailConnectedAt: new Date(),
    }, { merge: true });

    // Try to get the return URL from the request headers or default to dashboard
    const returnUrl = request.headers.get('referer')?.includes('/settings') ? '/settings' : '/dashboard';
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${returnUrl}?success=gmail_connected`
    );
  } catch (error) {
    console.error('Error handling Gmail OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?error=gmail_auth_error`
    );
  }
}
