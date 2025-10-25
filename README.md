# MediMoji - Doctor Automation Service

A comprehensive AI-powered platform for medical professionals that combines a conversational chatbot interface with specialized AI agents for practice management and medical illustration generation.

## Features

### AI Agent System
- **@email** - Mass Communication Agent
  - Template management for patient communications
  - Merge fields (patient name, appointment times, etc.)
  - Scheduling/delayed sending
  - Tracking (opened, clicked)
  - HIPAA-compliant email handling

  - Natural language queries → charts

- **@illustration** - Medical Illustration Agent
  - Text-to-medical-image generation
  - Anatomical diagrams, surgical procedure illustrations
  - Annotation and labeling capabilities
  - Style options (realistic, schematic, patient-friendly)

- **@assistant** - General Medical Assistant (default)
  - Clinical decision support
  - Literature search
  - Documentation help
  - Drug interaction checks

### Chat Interface
- Clean, clinical chat UI inspired by modern AI assistants
- Command system with @ triggers for different AI agents
- Persistent chat history per session
- Quick access toolbar for common functions
- Real-time agent suggestions

### Authentication
- Firebase Authentication with email/password and Google sign-in
- Secure user sessions
- HIPAA-compliant data handling

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **AI Integration**: LangGraph with OpenAI
- **Icons**: Lucide React
- **UI Components**: Radix UI primitives
- **Storage**: Firestore

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project with Authentication enabled
- OpenAI API key
- Google Cloud project with Gmail API enabled (for email features)

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
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Command System
Use @ commands to interact with specific AI agents:

- `@email send reminder to all patients` - Use the email agent
- `@illustration create heart diagram` - Use the illustration agent
- `@assistant check drug interactions` - Use the general assistant

### Sidebar Navigation
- Click on sidebar icons to switch between different functions
- Calendar, Patients, Documents, Files, and New options available
- Settings and logout in the bottom section

### Predefined Prompts
The interface includes helpful predefined prompts for common tasks:
- "What appointments do I have tomorrow?"
- "Please send my patients a reminder email for their next appointment"
- "Please give me a summary of how my patients are doing"
- "Give me an in depth analysis on one of my patients"
- "Give me historical data on one of my patients"

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── layout.tsx      # Root layout with AuthProvider
│   └── page.tsx        # Main page component
├── components/         # React components
│   ├── Dashboard.tsx   # Main dashboard component
│   ├── LoginPage.tsx   # Authentication page
│   ├── Sidebar.tsx     # Left navigation sidebar
│   └── ChatInterface.tsx # Main chat interface
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
└── lib/                # Utility libraries
    ├── firebase.ts     # Firebase configuration
    ├── langgraph-client.ts # LangGraph client implementation
    ├── gmail-oauth.ts  # Gmail OAuth integration
    ├── agents.ts       # AI agent implementations
    └── commandParser.ts # Command parsing utilities
```

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