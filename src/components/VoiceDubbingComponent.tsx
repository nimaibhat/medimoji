'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Play, Pause, Download, Languages, Volume2 } from 'lucide-react';

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

export default function VoiceDubbingComponent() {
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
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Array<{
    id: string;
    timestamp: string;
    sourceLanguage: string;
    targetLanguage: string;
    originalAudioUrl: string;
    dubbedAudioUrl: string;
    status: 'completed' | 'processing' | 'failed';
  }>>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    id: string;
    timestamp: string;
    title: string;
    exchanges: Array<{
      id: string;
      timestamp: string;
      sourceLanguage: string;
      targetLanguage: string;
      originalAudioUrl: string;
      dubbedAudioUrl: string;
      status: 'completed' | 'processing' | 'failed';
    }>;
  }>>([]);

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

  // Start continuous conversation
  const startContinuousConversation = useCallback(() => {
    setIsContinuousMode(true);
    setCurrentConversation([]);
    setError(null);
  }, []);

  // End continuous conversation
  const endContinuousConversation = useCallback(() => {
    if (currentConversation.length === 0) {
      setError('No exchanges in this conversation to save.');
      return;
    }

    const conversationId = `conv_${Date.now()}`;
    const conversationTitle = `Conversation ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    
    const savedConversation = {
      id: conversationId,
      timestamp: new Date().toLocaleString(),
      title: conversationTitle,
      exchanges: [...currentConversation]
    };

    setConversationHistory(prev => [savedConversation, ...prev]);
    setCurrentConversation([]);
    setIsContinuousMode(false);
  }, [currentConversation]);

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
    setDubbedAudioUrl(null); // Clear previous dubbed audio

    // Create conversation entry
    const exchangeId = `exchange_${Date.now()}`;
    const conversationEntry = {
      id: exchangeId,
      timestamp: new Date().toLocaleString(),
      sourceLanguage,
      targetLanguage,
      originalAudioUrl: audioUrl!,
      dubbedAudioUrl: '',
      status: 'processing' as const
    };

    if (isContinuousMode) {
      setCurrentConversation(prev => [...prev, conversationEntry]);
    } else {
      setConversationHistory(prev => [conversationEntry, ...prev]);
    }

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
        if (isContinuousMode) {
          setCurrentConversation(prev => 
            prev.map(exchange => 
              exchange.id === exchangeId 
                ? { ...exchange, status: 'failed' as const }
                : exchange
            )
          );
        } else {
          setConversationHistory(prev => 
            prev.map(conv => 
              conv.id === exchangeId 
                ? { ...conv, status: 'failed' as const }
                : conv
            )
          );
        }
      }
    } catch (err) {
      setError('Failed to process dubbing');
      console.error('Dubbing error:', err);
      // Update conversation status to failed
      if (isContinuousMode) {
        setCurrentConversation(prev => 
          prev.map(exchange => 
            exchange.id === exchangeId 
              ? { ...exchange, status: 'failed' as const }
              : exchange
          )
        );
      } else {
        setConversationHistory(prev => 
          prev.map(conv => 
            conv.id === exchangeId 
              ? { ...conv, status: 'failed' as const }
              : conv
          )
        );
      }
    } finally {
      setIsProcessing(false);
    }
  }, [audioBlob, targetLanguage, sourceLanguage, audioUrl, isContinuousMode]);

  // Poll dubbing status
  const pollDubbingStatus = useCallback(async (dubbingId: string, conversationId: string) => {
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
              
              // Update conversation history with completed status
              if (isContinuousMode) {
                setCurrentConversation(prev => 
                  prev.map(exchange => 
                    exchange.id === conversationId 
                      ? { ...exchange, dubbedAudioUrl, status: 'completed' as const }
                      : exchange
                  )
                );
              } else {
                setConversationHistory(prev => 
                  prev.map(conv => 
                    conv.id === conversationId 
                      ? { ...conv, dubbedAudioUrl, status: 'completed' as const }
                      : conv
                  )
                );
              }
              
              console.log('Dubbed audio downloaded successfully');
            } else {
              console.error('Failed to download dubbed audio:', audioResponse.status);
              setError('Failed to download dubbed audio');
              // Update conversation status to failed
              if (isContinuousMode) {
                setCurrentConversation(prev => 
                  prev.map(exchange => 
                    exchange.id === conversationId 
                      ? { ...exchange, status: 'failed' as const }
                      : exchange
                  )
                );
              } else {
                setConversationHistory(prev => 
                  prev.map(conv => 
                    conv.id === conversationId 
                      ? { ...conv, status: 'failed' as const }
                      : conv
                  )
                );
              }
            }
            return;
          }

          if (result.status.status === 'failed') {
            console.error('Dubbing failed:', result.status.error);
            setError(result.status.error || 'Dubbing failed');
            // Update conversation status to failed
            if (isContinuousMode) {
              setCurrentConversation(prev => 
                prev.map(exchange => 
                  exchange.id === conversationId 
                    ? { ...exchange, status: 'failed' as const }
                    : exchange
                )
              );
            } else {
              setConversationHistory(prev => 
                prev.map(conv => 
                  conv.id === conversationId 
                    ? { ...conv, status: 'failed' as const }
                    : conv
                )
              );
            }
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
            if (isContinuousMode) {
              setCurrentConversation(prev => 
                prev.map(exchange => 
                  exchange.id === conversationId 
                    ? { ...exchange, status: 'failed' as const }
                    : exchange
                )
              );
            } else {
              setConversationHistory(prev => 
                prev.map(conv => 
                  conv.id === conversationId 
                    ? { ...conv, status: 'failed' as const }
                    : conv
                )
              );
            }
          }
        } else {
          console.error('Status check failed:', result.error);
          setError(result.error || 'Failed to check dubbing status');
          // Update conversation status to failed
          if (isContinuousMode) {
            setCurrentConversation(prev => 
              prev.map(exchange => 
                exchange.id === conversationId 
                  ? { ...exchange, status: 'failed' as const }
                  : exchange
              )
            );
          } else {
            setConversationHistory(prev => 
              prev.map(conv => 
                conv.id === conversationId 
                  ? { ...conv, status: 'failed' as const }
                  : conv
              )
            );
          }
        }
      } catch (err) {
        console.error('Status check error:', err);
        setError('Failed to check dubbing status');
        // Update conversation status to failed
        if (isContinuousMode) {
          setCurrentConversation(prev => 
            prev.map(exchange => 
              exchange.id === conversationId 
                ? { ...exchange, status: 'failed' as const }
                : exchange
            )
          );
        } else {
          setConversationHistory(prev => 
            prev.map(conv => 
              conv.id === conversationId 
                ? { ...conv, status: 'failed' as const }
                : conv
            )
          );
        }
      }
    };

    poll();
  }, [targetLanguage, isContinuousMode]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <Volume2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Voice Dubbing Test</h1>
          </div>
          
          <p className="text-gray-600 mb-6">
            Record your voice and translate it to different languages using ElevenLabs Dubbing API.
          </p>

          {/* Watermark Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Audio Watermark Notice</h3>
            <p className="text-blue-700 text-sm mb-2">
              The dubbed audio will include a subtle ElevenLabs watermark to identify the service used.
            </p>
            <p className="text-blue-700 text-sm">
              This watermark is barely noticeable and doesn&apos;t affect the translation quality.
            </p>
          </div>

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

          {/* Continuous Conversation Controls */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Conversation Mode</h3>
            <div className="flex items-center space-x-4">
              {!isContinuousMode ? (
                <button
                  onClick={startContinuousConversation}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Volume2 className="h-4 w-4" />
                  <span>Start Continuous Conversation</span>
                </button>
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-700 font-medium">Continuous Mode Active</span>
                  </div>
                  <button
                    onClick={endContinuousConversation}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <span>End & Save Conversation</span>
                  </button>
                </div>
              )}
            </div>
            {isContinuousMode && (
              <p className="text-sm text-gray-600 mt-2">
                💡 In continuous mode, each translation will be added to the current conversation. 
                Click &quot;End & Save Conversation&quot; when the consultation is complete.
              </p>
            )}
          </div>
        </div>

        {/* Recording Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Record Audio</h2>
          
          {/* Permission Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Microphone Permission Required</h3>
            <p className="text-blue-700 text-sm mb-2">
              This feature requires microphone access. If you see a permission prompt, please click &quot;Allow&quot;.
            </p>
            <p className="text-blue-700 text-sm">
              If permission was denied, click the microphone icon in your browser&apos;s address bar and set it to &quot;Allow&quot;.
            </p>
          </div>
          
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

        {/* Current Conversation (Continuous Mode) */}
        {isContinuousMode && currentConversation.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Current Conversation</h2>
            
            <div className="space-y-4">
              {currentConversation.map((exchange, index) => (
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

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Saved Conversations</h2>
            
            <div className="space-y-6">
              {conversationHistory.map((conversation) => (
                <div key={conversation.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{conversation.title}</h3>
                      <p className="text-sm text-gray-600">{conversation.timestamp}</p>
                      <p className="text-sm text-gray-500">{conversation.exchanges.length} exchanges</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {conversation.exchanges.map((exchange, index) => (
                      <div key={exchange.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-800 text-sm">
                            Exchange {index + 1}: {languages.find(l => l.code === exchange.sourceLanguage)?.name || exchange.sourceLanguage} → {languages.find(l => l.code === exchange.targetLanguage)?.name || exchange.targetLanguage}
                          </h4>
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
                          <div className="bg-white rounded p-2">
                            <h5 className="font-medium text-gray-700 mb-1 text-xs">Original</h5>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => playAudio(exchange.originalAudioUrl)}
                                className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                              >
                                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                <span>Play</span>
                              </button>
                              <button
                                onClick={() => downloadAudio(exchange.originalAudioUrl, `original_${exchange.id}.webm`)}
                                className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                              >
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Translated Audio */}
                          <div className="bg-white rounded p-2">
                            <h5 className="font-medium text-gray-700 mb-1 text-xs">Translated</h5>
                            {exchange.status === 'completed' && exchange.dubbedAudioUrl ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => playAudio(exchange.dubbedAudioUrl)}
                                  className="flex items-center space-x-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                                >
                                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                  <span>Play</span>
                                </button>
                                <button
                                  onClick={() => downloadAudio(exchange.dubbedAudioUrl, `translated_${exchange.id}.mp3`)}
                                  className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Download</span>
                                </button>
                              </div>
                            ) : exchange.status === 'processing' ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                                <span className="text-xs text-gray-600">Processing...</span>
                              </div>
                            ) : (
                              <span className="text-xs text-red-600">Translation failed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-8">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Hidden Audio Element */}
        <audio ref={audioRef} />
      </div>
    </div>
  );
}
