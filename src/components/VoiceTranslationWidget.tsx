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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Languages className="h-6 w-6" />
              <h2 className="text-xl font-bold">Medical Translation</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Language Selector */}
          <div className="mt-4 flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">From</label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full p-2 rounded-lg text-gray-900"
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
              className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
              disabled={isLiveMode}
            >
              ↔
            </button>
            
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">To</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full p-2 rounded-lg text-gray-900"
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
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-black mb-2">Current Translation</h3>
              <p className="text-black">{currentTranslation}</p>
              <div className="flex items-center space-x-2 mt-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <span className="text-xs text-gray-500">Audio playback</span>
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
                  className={`p-4 rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  } ${(!isInitialized || isTranslating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                
                <button
                  onClick={startLiveTranslation}
                  disabled={!isInitialized}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  <span>Start Live Translation</span>
                </button>
              </>
            ) : (
              <button
                onClick={stopLiveTranslation}
                className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="h-5 w-5" />
                <span>Stop Live Translation</span>
              </button>
            )}
          </div>

          {/* Translation History */}
          {translationHistory.length > 0 && (
            <div>
              <h3 className="font-medium text-black mb-3">Recent Translations</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {translationHistory.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-gray-500">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="text-xs text-green-600">
                        {Math.round(item.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-black mb-1">
                      <strong>Original:</strong> {item.original}
                    </p>
                    <p className="text-sm text-black">
                      <strong>Translated:</strong> {item.translated}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="text-center">
            {isTranslating && (
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Translating...</span>
              </div>
            )}
            {isLiveMode && (
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                <span>Live translation active</span>
              </div>
            )}
            {!isInitialized && (
              <div className="flex items-center justify-center space-x-2 text-orange-600">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                <span>Translation service loading...</span>
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
