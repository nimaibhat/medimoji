# MediMoji

Medimoji is a clinician‑friendly assistant that turns conversations, sketches, and instructions into clear medical visuals, summaries, and multilingual voice outputs. It focuses on removing language and literacy barriers in care.

## Features

### Live Translation + Reports
- Real‑time language translation during consultation
- Instant physician summary reports and transcripts
- Optional Gmail agent for secure sharing via Google OAuth

How it works:
- Audio is captured in-browser, transcribed, translated, and optionally dubbed into the target language while preserving timing.
- A reporting pipeline assembles transcripts, translations, and key findings into physician‑friendly summaries.
- Conversations and generated media are stored securely, enabling playback, downloads, and history.

### Interactive Pain Map
- Dynamic 3D body diagram where patients mark pain location, intensity, and type
- Converts inputs into structured reports for clinicians
- Supports male/female models, front/back views, and multiple pain types

How it works:
- A web‑based 3D human model allows patients to click and annotate pain points with type and intensity.
- The system infers likely anatomical regions from coordinates and aggregates multiple points into a structured, shareable report.
- Built-in fallbacks ensure graceful behavior on lower‑end devices and during model loading.

### AI Visual Education
- From physician notes, generates simple, patient‑friendly infographics or comics
- Minimal text; visuals optimized for health literacy
- Powered by multi‑agent prompts and image generation backends

How it works:
- A language understanding layer extracts the educational intent from notes and chooses an appropriate visual style (schematic, patient‑friendly, comic, realistic).
- An image generation layer creates multi‑panel visuals with minimal text, optimized for comprehension and cultural sensitivity.
- Optional retrieval and revision steps refine prompts and outputs before delivery to the clinician.

### Authentication
- Firebase Authentication with email/password and Google sign-in
- Secure user sessions
- HIPAA-compliant data handling

### Conversation & History
- Layered message processing with agent routing
- Persistent conversation history and voice conversation logs

How it works:
- The application maintains authenticated sessions and routes each user request to the right capability (assistant, illustration, email, voice) using a lightweight classifier.
- Conversations, media, and generated content are persisted to enable longitudinal context and reuse across visits.
- The UI surfaces past exchanges, audio playbacks, and generated visuals for quick review and sharing.

## Tech Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **3D/Visualization**: Three.js, React Three Fiber
- **Backend & Auth**: Firebase, Firestore/Storage, Firebase Auth, Google OAuth (Gmail agent)
- **AI/ML**: LangChain, LangGraph, OpenAI, Replicate, ElevenLabs (dubbing/voice)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project with Auth, Firestore, and Storage
- OpenAI API key
- ElevenLabs API key (for dubbing/voice)
- Google Cloud project with Gmail API enabled (for email agent)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd medimoji
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key  # Fallback for development
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For OAuth callbacks

# Google OAuth Configuration (for Gmail integration)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# ElevenLabs (Voice Dubbing)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Optional: Firebase Admin for server features
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Sidebar Navigation
- Click on sidebar icons to switch between different functions
- Calendar, Patients, Documents, Files, and New options available
- Settings and logout in the bottom section

### Agents and Commands
- `@illustration` – create medical visuals from notes
- `@assistant` – general reasoning, summaries, explanations
- `@email` – Gmail agent for secure communications

## Project Structure

```
src/
├── app/                      # Next.js app directory
│   ├── landing/              # Public landing page
│   ├── dashboard/            # Main dashboard
│   ├── voice-history/        # Voice conversation history
│   └── api/                  # Server routes (Next.js Route Handlers)
│       ├── elevenlabs-dubbing/
│       ├── generate-image/
│       ├── gmail/send/
│       ├── transcribe-audio/
│       └── analyze-pain/
├── components/               # UI & feature components
│   ├── ChatInterface.tsx
│   ├── VoiceDubbingComponent.tsx
│   ├── PatientVoiceDubbingComponent.tsx
│   ├── ThreeDBodyDiagram.tsx
│   └── PainDrawingTool.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── VoiceConversationContext.tsx
└── lib/                      # AI, services, and integrations
    ├── elevenlabs-dubbing-service.ts
    ├── natural-illustration-agent.ts
    ├── natural-email-agent.ts
    ├── transcription-service.ts
    ├── langgraph-client.ts
    └── firebase.ts
```

## Security & Privacy

- Authentication handled by Firebase Auth; API keys are server‑side where possible
- Avoid sending PHI to third‑party APIs unless explicitly configured for compliance
- Environment variables are required for external services; do not commit secrets

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@medimoji.com or create an issue in the repository.
