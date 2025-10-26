'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Download, Languages, Volume2, Save, ArrowLeft, User, Calendar, Clock } from 'lucide-react';
import { AudioStorageService } from '@/lib/audio-storage-service';
import { useVoiceConversation } from '@/contexts/VoiceConversationContext';
import { useAuth } from '@/contexts/AuthContext';
import PatientForm from './PatientForm';

interface DubbingStatus {
  dubbing_id: string;
  status: 'pending' | 'processing' | 'dubbed' | 'failed';
  target_lang: string;
  created_at: string;
  error?: string;
}

interface Language {
  code: string;
  name: string;
}

interface Exchange {
  id: string;
  timestamp: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalAudioUrl: string;
  dubbedAudioUrl: string;
  status: 'completed' | 'processing' | 'failed';
  duration?: number;
}

export default function VoiceDubbingComponent() {
  const { user } = useAuth();
  const { 
    currentConversationId, 
    currentPatientInfo, 
    addTranslation, 
    completeConversation,
    startNewConversation,
    isLoading: contextLoading,
    error: contextError 
  } = useVoiceConversation();

  const [showPatientForm, setShowPatientForm] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dubbedAudioUrl, setDubbedAudioUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [dubbingStatus, setDubbingStatus] = useState<DubbingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTimestamp, setRecordingTimestamp] = useState<string | null>(null);
  const [currentExchanges, setCurrentExchanges] = useState<Exchange[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load available languages
  const loadLanguages = useCallback(async () => {
    try {
      const response = await fetch('/api/elevenlabs-dubbing?action=languages');
      const result = await response.json();
      
      if (result.success) {
        setLanguages(result.languages);
      }
    } catch (err) {
      console.error('Failed to load languages:', err);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Clear previous results when starting new recording
      setDubbedAudioUrl(null);
      setDubbingStatus(null);
      setError(null);
      setRecordingTimestamp(null);
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported in this browser');
      }

      // Request microphone permission with better error handling
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        setRecordingTimestamp(new Date().toLocaleTimeString());
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please allow microphone access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else if (err.name === 'NotSupportedError') {
          setError('Microphone access not supported. Please use HTTPS or localhost.');
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError('Failed to access microphone. Please check permissions.');
      }
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Process dubbing
  const processDubbing = useCallback(async () => {
    if (!audioBlob) {
      setError('No audio recording available. Please record audio first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setDubbingStatus(null);
    setDubbedAudioUrl(null);

    // Create conversation entry
    const exchangeId = `exchange_${Date.now()}`;
    const conversationEntry: Exchange = {
      id: exchangeId,
      timestamp: new Date().toLocaleString(),
      sourceLanguage,
      targetLanguage,
      originalAudioUrl: audioUrl!,
      dubbedAudioUrl: '',
      status: 'processing'
    };

    setCurrentExchanges(prev => [...prev, conversationEntry]);

    try {
      console.log('Processing dubbing with audio blob size:', audioBlob.size);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('targetLanguage', targetLanguage);
      formData.append('sourceLanguage', sourceLanguage);

      const response = await fetch('/api/elevenlabs-dubbing', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        console.log('Dubbing started successfully:', result.dubbing);
        setDubbingStatus(result.dubbing);
        
        // Poll for completion
        await pollDubbingStatus(result.dubbing.dubbing_id, exchangeId);
      } else {
        setError(result.error);
        // Update conversation status to failed
        setCurrentExchanges(prev => 
          prev.map(exchange => 
            exchange.id === exchangeId 
              ? { ...exchange, status: 'failed' as const }
              : exchange
          )
        );
      }
    } catch (err) {
      setError('Failed to process dubbing');
      console.error('Dubbing error:', err);
      // Update conversation status to failed
      setCurrentExchanges(prev => 
        prev.map(exchange => 
          exchange.id === exchangeId 
            ? { ...exchange, status: 'failed' as const }
            : exchange
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [audioBlob, targetLanguage, sourceLanguage, audioUrl]);

  // Poll dubbing status
  const pollDubbingStatus = useCallback(async (dubbingId: string, exchangeId: string) => {
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        console.log(`Checking dubbing status (attempt ${attempts + 1}/${maxAttempts}) for ID: ${dubbingId}`);
        
        const response = await fetch(`/api/elevenlabs-dubbing?action=status&dubbingId=${dubbingId}`);
        const result = await response.json();

        console.log('Status check result:', result);

        if (result.success) {
          setDubbingStatus(result.status);

          if (result.status.status === 'dubbed') {
            console.log('Dubbing completed, downloading audio...');
            // Download the dubbed audio
            const audioResponse = await fetch(`/api/elevenlabs-dubbing?action=audio&dubbingId=${dubbingId}&targetLanguage=${targetLanguage}`);
            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              const dubbedAudioUrl = URL.createObjectURL(audioBlob);
              setDubbedAudioUrl(dubbedAudioUrl);
              
              // Upload audio to Firebase Storage for persistence
              let persistentOriginalUrl = audioUrl!;
              let persistentTranslatedUrl = dubbedAudioUrl;

              console.log('Starting audio upload to Firebase Storage...');
              console.log('Original audio URL:', audioUrl);
              console.log('Translated audio URL:', dubbedAudioUrl);
              console.log('Conversation ID:', currentConversationId);
              console.log('Exchange ID:', exchangeId);

              try {
                if (!currentConversationId) {
                  throw new Error('No active conversation');
                }
                
                const { originalUrl, translatedUrl } = await AudioStorageService.uploadExchangeAudio(
                  currentConversationId,
                  exchangeId,
                  audioUrl!,
                  dubbedAudioUrl,
                  sourceLanguage,
                  targetLanguage
                );
                persistentOriginalUrl = originalUrl;
                persistentTranslatedUrl = translatedUrl;
                console.log('Audio uploaded to Firebase Storage successfully');
                console.log('Persistent original URL:', originalUrl);
                console.log('Persistent translated URL:', translatedUrl);
              } catch (uploadError) {
                console.error('Failed to upload audio to storage:', uploadError);
                console.warn('Using blob URLs as fallback');
                // Continue with blob URLs as fallback
              }

              // Update conversation history with completed status
              setCurrentExchanges(prev => 
                prev.map(exchange => 
                  exchange.id === exchangeId 
                    ? { ...exchange, dubbedAudioUrl: persistentTranslatedUrl, status: 'completed' as const }
                    : exchange
                )
              );

              // Save to Firebase with persistent URLs
              if (currentConversationId) {
                try {
                  console.log('Saving translation to Firebase...');
                  console.log('Translation data:', {
                    id: exchangeId,
                    timestamp: new Date().toLocaleString(),
                    sourceLanguage,
                    targetLanguage,
                    originalAudioUrl: persistentOriginalUrl,
                    translatedAudioUrl: persistentTranslatedUrl,
                    status: 'completed'
                  });

                  await addTranslation({
                    id: exchangeId,
                    timestamp: new Date().toLocaleString(),
                    sourceLanguage,
                    targetLanguage,
                    originalAudioUrl: persistentOriginalUrl,
                    translatedAudioUrl: persistentTranslatedUrl,
                    status: 'completed'
                  });
                  
                  console.log('Translation saved to Firebase successfully');
                } catch (err) {
                  console.error('Failed to save translation to Firebase:', err);
                }
              }
              
              console.log('Dubbed audio downloaded successfully');
            } else {
              console.error('Failed to download dubbed audio:', audioResponse.status);
              setError('Failed to download dubbed audio');
              // Update conversation status to failed
              setCurrentExchanges(prev => 
                prev.map(exchange => 
                  exchange.id === exchangeId 
                    ? { ...exchange, status: 'failed' as const }
                    : exchange
                )
              );
            }
            return;
          }

          if (result.status.status === 'failed') {
            console.error('Dubbing failed:', result.status.error);
            setError(result.status.error || 'Dubbing failed');
            // Update conversation status to failed
            setCurrentExchanges(prev => 
              prev.map(exchange => 
                exchange.id === exchangeId 
                  ? { ...exchange, status: 'failed' as const }
                  : exchange
              )
            );
            return;
          }

          // Continue polling
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Dubbing still in progress (${result.status.status}), continuing to poll...`);
            setTimeout(poll, 5000);
          } else {
            console.error('Dubbing timeout - process took too long');
            setError('Dubbing timeout - process took too long. Please try again.');
            // Update conversation status to failed
            setCurrentExchanges(prev => 
              prev.map(exchange => 
                exchange.id === exchangeId 
                  ? { ...exchange, status: 'failed' as const }
                  : exchange
              )
            );
          }
        } else {
          console.error('Status check failed:', result.error);
          setError(result.error || 'Failed to check dubbing status');
          // Update conversation status to failed
          setCurrentExchanges(prev => 
            prev.map(exchange => 
              exchange.id === exchangeId 
                ? { ...exchange, status: 'failed' as const }
                : exchange
            )
          );
        }
      } catch (err) {
        console.error('Status check error:', err);
        setError('Failed to check dubbing status');
        // Update conversation status to failed
        setCurrentExchanges(prev => 
          prev.map(exchange => 
            exchange.id === exchangeId 
              ? { ...exchange, status: 'failed' as const }
              : exchange
          )
        );
      }
    };

    poll();
  }, [targetLanguage, addTranslation, currentConversationId, audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Play audio
  const playAudio = useCallback((url: string) => {
    // Stop any other audio playing in the app
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
      }
    });

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      console.error('Audio playback error');
      setIsPlaying(false);
    };
    
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    });
  }, []);

  // Download audio
  const downloadAudio = useCallback((url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }, []);

  // Handle patient form submission
  const handlePatientFormSubmit = useCallback(async (patientInfo: { name: string; age: number; gender: string; medicalHistory: string }) => {
    console.log('handlePatientFormSubmit called with:', patientInfo);
    console.log('User UID:', user?.uid);
    
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }

    try {
      console.log('Starting new conversation...');
      await startNewConversation(patientInfo, user.uid);
      console.log('Conversation started successfully');
      setShowPatientForm(false);
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Failed to start conversation');
    }
  }, [user?.uid, startNewConversation]);

  // Handle conversation completion
  const handleCompleteConversation = useCallback(async () => {
    try {
      await completeConversation();
      setShowPatientForm(true);
      setCurrentExchanges([]);
      setAudioBlob(null);
      setAudioUrl(null);
      setDubbedAudioUrl(null);
    } catch (err) {
      setError('Failed to complete conversation');
    }
  }, [completeConversation]);

  // Show patient form if no active conversation
  if (showPatientForm || !currentConversationId) {
    return (
      <PatientForm 
        onStartConversation={handlePatientFormSubmit}
        onCancel={() => setShowPatientForm(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with Patient Info */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Voice Translation Session</h1>
            </div>
            <button
              onClick={() => setShowPatientForm(true)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Patient Info</span>
            </button>
          </div>
          
          {/* Patient Information Display */}
          {currentPatientInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-800 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Current Patient Session
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Patient:</span>
                  <span className="text-sm">{currentPatientInfo.patientName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Date:</span>
                  <span className="text-sm">{currentPatientInfo.date}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Time:</span>
                  <span className="text-sm">{currentPatientInfo.time}</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-gray-600 mb-6">
            Record your voice and translate it to different languages using ElevenLabs Dubbing API.
          </p>

          {/* Language Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-4">
              <Languages className="h-5 w-5 text-gray-500" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Language</label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ar">Arabic</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Languages className="h-5 w-5 text-gray-500" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Language</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onFocus={loadLanguages}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ar">Arabic</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Record Audio</h2>
          
          <div className="flex items-center justify-center space-x-4 mb-6">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Mic className="h-5 w-5" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <MicOff className="h-5 w-5" />
                <span>Stop Recording</span>
              </button>
            )}
          </div>

          {/* Audio Playback */}
          {audioUrl && (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">
                Original Recording
                {recordingTimestamp && (
                  <span className="text-sm text-gray-600 ml-2">
                    (Recorded at {recordingTimestamp})
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => playAudio(audioUrl)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={() => downloadAudio(audioUrl, 'original_recording.webm')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}

          {/* Dubbing Button */}
          {audioBlob && (
            <div className="text-center">
              <button
                onClick={processDubbing}
                disabled={isProcessing}
                className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? 'Processing...' : `Translate ${languages.find(l => l.code === sourceLanguage)?.name || sourceLanguage} to ${languages.find(l => l.code === targetLanguage)?.name || targetLanguage}`}
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
              <strong className="font-bold">Error:</strong>
              <span className="block sm:inline"> {error}</span>
            </div>
          )}
        </div>

        {/* Current Session Exchanges */}
        {currentExchanges.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Session Exchanges</h2>
            
            <div className="space-y-4">
              {currentExchanges.map((exchange, index) => (
                <div key={exchange.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Exchange {index + 1}: {languages.find(l => l.code === exchange.sourceLanguage)?.name || exchange.sourceLanguage} → {languages.find(l => l.code === exchange.targetLanguage)?.name || exchange.targetLanguage}
                      </h3>
                      <p className="text-sm text-gray-600">{exchange.timestamp}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      exchange.status === 'completed' ? 'bg-green-100 text-green-800' :
                      exchange.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {exchange.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Original Audio */}
                    <div className="bg-gray-50 rounded p-3">
                      <h4 className="font-medium text-gray-800 mb-1 text-sm">Original</h4>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => playAudio(exchange.originalAudioUrl)}
                          className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                        >
                          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          <span>Play</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Translated Audio */}
                    <div className="bg-gray-50 rounded p-3">
                      <h4 className="font-medium text-gray-800 mb-1 text-sm">Translated</h4>
                      {exchange.status === 'completed' && exchange.dubbedAudioUrl ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => playAudio(exchange.dubbedAudioUrl)}
                            className="flex items-center space-x-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                          >
                            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            <span>Play</span>
                          </button>
                        </div>
                      ) : exchange.status === 'processing' ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                          <span className="text-xs text-gray-600">Processing...</span>
                        </div>
                      ) : (
                        <span className="text-xs text-red-600">Failed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete Session Button */}
        {currentExchanges.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center">
              <button
                onClick={handleCompleteConversation}
                disabled={contextLoading}
                className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors mx-auto"
              >
                <Save className="h-5 w-5" />
                <span>{contextLoading ? 'Saving...' : 'Complete & Save Session'}</span>
              </button>
              <p className="text-sm text-gray-600 mt-2">
                This will save the entire conversation to your patient records.
              </p>
            </div>
          </div>
        )}

        {/* Hidden Audio Element */}
        <audio ref={audioRef} />
      </div>
    </div>
  );
}
