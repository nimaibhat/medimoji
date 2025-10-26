// Firebase schema for voice conversations - optimized for translation storage
export interface VoiceTranslation {
  id: string;
  patientInfo: {
    patientName: string;
    patientId?: string;
    date: string;
    time: string;
    doctorName: string;
    visitType: string;
    notes?: string;
  };
  translations: Array<{
    id: string;
    timestamp: string;
    sourceLanguage: string;
    targetLanguage: string;
    originalAudioUrl: string;
    translatedAudioUrl: string;
    status: 'completed' | 'processing' | 'failed';
    duration?: number;
    textTranscript?: string; // Optional: store transcribed text
    originalTranscript?: string; // Transcribed original audio
    translatedTranscript?: string; // Transcribed translated audio
  }>;
  sessionInfo: {
    totalDuration: number;
    languagePairs: string[];
    exchangeCount: number;
    startTime: string;
    endTime?: string;
  };
  transcription?: {
    isTranscribed: boolean;
    transcribedAt?: string;
    transcripts: Array<{
      timestamp: string;
      language: string;
      text: string;
      audioType: 'original' | 'translated';
    }>;
  };
  medicalReport?: {
    isGenerated: boolean;
    generatedAt?: string;
    summary: string;
    keyPoints: string[];
    recommendations: string[];
    followUpRequired: boolean;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    doctorId: string;
    status: 'active' | 'completed' | 'archived';
  };
}

export interface VoiceTranslationSummary {
  id: string;
  patientName: string; // For UI display
  patientId?: string;   // For HIPAA-compliant reports
  date: string;
  time: string;
  doctorName: string;
  visitType: string;
  exchangeCount: number;
  totalDuration: number;
  createdAt: string;
  status: 'active' | 'completed' | 'archived';
  languagePairs: string[];
}
