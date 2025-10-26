# ElevenLabs Voice Dubbing System - Environment Setup

## Required Environment Variables

Add these to your `.env.local` file:

```env
# ElevenLabs Dubbing API
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Existing variables (keep these)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key

OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Your ElevenLabs API Key

1. Go to [ElevenLabs](https://elevenlabs.io/)
2. Sign up for an account
3. Navigate to your profile settings
4. Copy your API key
5. Add it to your `.env.local` file as `ELEVENLABS_API_KEY`

## Usage Instructions

1. **Install Dependencies**: The system uses standard Next.js dependencies
2. **Set Environment Variables**: Add your ElevenLabs API key to `.env.local`
3. **Test Pages**:
   - Real ElevenLabs: `http://localhost:3000/test-voice-dubbing`
   - Mock System: `http://localhost:3000/test-mock-dubbing`
4. **Features**:
   - Continuous conversation mode
   - Bidirectional translation (English ↔ Spanish, etc.)
   - Conversation history
   - Audio playback and download
   - Real-time status updates

## Key Features

- **Continuous Conversations**: Start/end conversation sessions
- **Bidirectional Translation**: Support for multiple language pairs
- **Real-time Processing**: Status updates and progress indicators
- **Audio Management**: Play, pause, and download functionality
- **Error Handling**: Comprehensive error messages and fallbacks
- **Mock System**: For testing without API costs
- **Watermark Support**: ElevenLabs watermark handling for free tier

## Testing Without API Key

If you don't have an ElevenLabs API key yet, you can test the system using the mock implementation at:
`http://localhost:3000/test-mock-dubbing`

This will simulate the dubbing process without making actual API calls.
