'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Languages, Volume2, VolumeX, Settings, Phone, PhoneOff } from 'lucide-react';

// Define supported languages inline
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
];

interface VoiceTranslationWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  medicalContext?: string;
}

export default function VoiceTranslationWidget({ 
  isOpen, 
  onClose, 
  medicalContext = 'general' 
}: VoiceTranslationWidgetProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [isMuted, setIsMuted] = useState(false);
  const [translationHistory, setTranslationHistory] = useState<Array<{
    id: string;
    original: string;
    translated: string;
    timestamp: Date;
    confidence: number;
  }>>([]);
  const [currentTranslation, setCurrentTranslation] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    initializeService();
  }, []);

  const initializeService = async () => {
    // TODO: Replace with actual translation service initialization
    setIsInitialized(true);
  };

  const startListening = async () => {
    if (!isInitialized) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudioTranslation(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const processAudioTranslation = async (audioBlob: Blob) => {
    setIsTranslating(true);

    try {
      // TODO: Replace with actual translation service
      console.log('Processing audio translation', { sourceLanguage, targetLanguage, medicalContext });

      // Mock translation result
      const mockTranslatedText = 'Translation functionality is being updated...';
      const mockOriginalText = 'Detected speech...';

      setCurrentTranslation(mockTranslatedText);

      // Add to history
      const newTranslation = {
        id: Date.now().toString(),
        original: mockOriginalText,
        translated: mockTranslatedText,
        timestamp: new Date(),
        confidence: 0.95
      };

      setTranslationHistory(prev => [newTranslation, ...prev.slice(0, 9)]); // Keep last 10
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const startLiveTranslation = async () => {
    try {
      // TODO: Replace with actual live translation service
      console.log('Starting live translation', { sourceLanguage, targetLanguage });
      setIsLiveMode(true);
    } catch (error) {
      console.error('Failed to start live translation:', error);
    }
  };

  const stopLiveTranslation = async () => {
    try {
      // TODO: Replace with actual live translation service
      console.log('Stopping live translation');
      setIsLiveMode(false);
    } catch (error) {
      console.error('Failed to stop live translation:', error);
    }
  };

  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden" style={{ backgroundColor: '#F8FBFC' }}>
        {/* Header */}
        <div className="p-6" style={{ backgroundColor: '#113B5C' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#76C5E0' }}>
                <Languages className="h-6 w-6" style={{ color: '#113B5C' }} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">Medical Translation</h2>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#76C5E0' }}>Voice Translation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-2 rounded-lg hover:bg-white hover:bg-opacity-10"
            >
              ✕
            </button>
          </div>
          
          {/* Language Selector */}
          <div className="mt-6 flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 text-white">From</label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full p-3 rounded-lg text-gray-900 border-2 transition-colors"
                style={{ borderColor: '#76C5E0' }}
                disabled={isLiveMode}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={swapLanguages}
              className="p-3 rounded-lg transition-colors text-white border-2"
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                borderColor: '#76C5E0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              }}
              disabled={isLiveMode}
            >
              ↔
            </button>
            
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 text-white">To</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full p-3 rounded-lg text-gray-900 border-2 transition-colors"
                style={{ borderColor: '#76C5E0' }}
                disabled={isLiveMode}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Translation */}
          {currentTranslation && (
            <div className="bg-white rounded-lg p-4 border-2" style={{ borderColor: '#76C5E0' }}>
              <h3 className="font-medium mb-2" style={{ color: '#113B5C' }}>Current Translation</h3>
              <p className="text-gray-900">{currentTranslation}</p>
              <div className="flex items-center space-x-2 mt-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: '#76C5E0' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FBFC';
                    e.currentTarget.style.color = '#113B5C';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#76C5E0';
                  }}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <span className="text-xs" style={{ color: '#76C5E0' }}>Audio playback</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            {!isLiveMode ? (
              <>
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={!isInitialized || isTranslating}
                  className={`p-4 rounded-full transition-colors text-white ${
                    (!isInitialized || isTranslating) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{
                    backgroundColor: isListening ? '#dc2626' : '#113B5C'
                  }}
                  onMouseEnter={(e) => {
                    if (!isInitialized || isTranslating) return;
                    e.currentTarget.style.backgroundColor = isListening ? '#b91c1c' : '#0F2A3F';
                  }}
                  onMouseLeave={(e) => {
                    if (!isInitialized || isTranslating) return;
                    e.currentTarget.style.backgroundColor = isListening ? '#dc2626' : '#113B5C';
                  }}
                >
                  {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                
                <button
                  onClick={startLiveTranslation}
                  disabled={!isInitialized}
                  className="flex items-center space-x-2 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: '#76C5E0', 
                    color: '#113B5C'
                  }}
                  onMouseEnter={(e) => {
                    if (!isInitialized) return;
                    e.currentTarget.style.backgroundColor = '#5BB5D1';
                  }}
                  onMouseLeave={(e) => {
                    if (!isInitialized) return;
                    e.currentTarget.style.backgroundColor = '#76C5E0';
                  }}
                >
                  <Phone className="h-5 w-5" />
                  <span>Start Live Translation</span>
                </button>
              </>
            ) : (
              <button
                onClick={stopLiveTranslation}
                className="flex items-center space-x-2 px-6 py-3 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: '#dc2626', 
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
              >
                <PhoneOff className="h-5 w-5" />
                <span>Stop Live Translation</span>
              </button>
            )}
          </div>

          {/* Translation History */}
          {translationHistory.length > 0 && (
            <div>
              <h3 className="font-medium mb-3" style={{ color: '#113B5C' }}>Recent Translations</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {translationHistory.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg p-3 border-2" style={{ borderColor: '#76C5E0' }}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs" style={{ color: '#76C5E0' }}>
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#F8FBFC', color: '#113B5C' }}>
                        {Math.round(item.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-1">
                      <strong style={{ color: '#113B5C' }}>Original:</strong> {item.original}
                    </p>
                    <p className="text-sm text-gray-900">
                      <strong style={{ color: '#113B5C' }}>Translated:</strong> {item.translated}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="text-center">
            {isTranslating && (
              <div className="flex items-center justify-center space-x-2" style={{ color: '#113B5C' }}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#113B5C' }}></div>
                <span className="font-medium">Translating...</span>
              </div>
            )}
            {isLiveMode && (
              <div className="flex items-center justify-center space-x-2" style={{ color: '#76C5E0' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#76C5E0' }}></div>
                <span className="font-medium">Live translation active</span>
              </div>
            )}
            {!isInitialized && (
              <div className="flex items-center justify-center space-x-2" style={{ color: '#76C5E0' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#76C5E0' }}></div>
                <span className="font-medium">Translation service loading...</span>
              </div>
            )}
          </div>
        </div>

        {/* Audio element for playback */}
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
}
