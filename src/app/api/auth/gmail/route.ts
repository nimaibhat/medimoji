import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuth } from '@/lib/gmail-oauth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const gmailOAuth = new GmailOAuth();
    const authUrl = gmailOAuth.getAuthUrl(userId);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating Gmail auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
