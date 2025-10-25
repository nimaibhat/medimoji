# ElevenLabs Voice Dubbing System - Complete Code

This document contains all the code for the ElevenLabs voice dubbing system with continuous conversation functionality.

---

## 1. ElevenLabs Dubbing Service (`src/lib/elevenlabs-dubbing-service.ts`)

```typescript
interface DubbingRequest {
  audioFile: File;
  targetLanguage: string;
  sourceLanguage?: string;
}

interface DubbingResponse {
  dubbing_id: string;
  status: 'pending' | 'processing' | 'dubbed' | 'failed';
  target_lang: string;
  created_at: string;
}

interface DubbingStatus {
  dubbing_id: string;
  status: 'pending' | 'processing' | 'dubbed' | 'failed';
  target_lang: string;
  created_at: string;
  error?: string;
}

interface DubbingLanguage {
  iso_639_1: string;
  name: string;
}

export class ElevenLabsDubbingService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static async create(): Promise<ElevenLabsDubbingService> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to environment variables.');
    }

    return new ElevenLabsDubbingService(apiKey);
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async makeFileRequest<T>(
    endpoint: string, 
    formData: FormData
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Start dubbing process
   */
  async startDubbing(audioFile: File, targetLanguage: string, allowWatermark: boolean = true): Promise<DubbingResponse> {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('target_lang', targetLanguage);
    
    // Allow watermark for free tier users
    if (allowWatermark) {
      formData.append('allow_watermark', 'true');
    }

    return this.makeFileRequest<DubbingResponse>('/dubbing', formData);
  }

  /**
   * Check dubbing status
   */
  async getDubbingStatus(dubbingId: string): Promise<DubbingStatus> {
    return this.makeRequest<DubbingStatus>(`/dubbing/${dubbingId}`);
  }

  /**
   * Get dubbed audio file
   */
  async getDubbedAudio(dubbingId: string, targetLanguage: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/dubbing/${dubbingId}/audio/${targetLanguage}`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response.blob();
  }

  /**
   * Get available languages for dubbing
   */
  async getAvailableLanguages(): Promise<Array<{ code: string; name: string }>> {
    // ElevenLabs supports these languages for dubbing
    return [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'hi', name: 'Hindi' },
      { code: 'en', name: 'English' }
    ];
  }
}
```

---

## 2. ElevenLabs Dubbing API Route (`src/app/api/elevenlabs-dubbing/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/elevenlabs-dubbing-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const targetLanguage = formData.get('targetLanguage') as string;
    const sourceLanguage = formData.get('sourceLanguage') as string;

    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'Audio file is required'
      }, { status: 400 });
    }

    if (!targetLanguage) {
      return NextResponse.json({
        success: false,
        error: 'Target language is required'
      }, { status: 400 });
    }

    const dubbingService = await ElevenLabsDubbingService.create();
    
    // Start dubbing process with watermark allowed
    const dubbingResponse = await dubbingService.startDubbing(audioFile, targetLanguage, true);

    return NextResponse.json({
      success: true,
      dubbing: dubbingResponse
    });

  } catch (error) {
    console.error('ElevenLabs dubbing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const dubbingId = searchParams.get('dubbingId');
  const targetLanguage = searchParams.get('targetLanguage');

  try {
    const dubbingService = await ElevenLabsDubbingService.create();

    switch (action) {
      case 'status':
        if (!dubbingId) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID is required'
          }, { status: 400 });
        }

        const status = await dubbingService.getDubbingStatus(dubbingId);
        return NextResponse.json({
          success: true,
          status
        });

      case 'audio':
        if (!dubbingId || !targetLanguage) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID and target language are required'
          }, { status: 400 });
        }

        const audioBlob = await dubbingService.getDubbedAudio(dubbingId, targetLanguage);
        
        return new NextResponse(audioBlob, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="dubbed_audio_${targetLanguage}.mp3"`
          }
        });

      case 'languages':
        const languages = await dubbingService.getAvailableLanguages();
        return NextResponse.json({
          success: true,
          languages
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: status, audio, or languages'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('ElevenLabs API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

---

## 3. Voice Dubbing Component (`src/components/VoiceDubbingComponent.tsx`)

```typescript
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

  // Play audio
  const playAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => setIsPlaying(false);
    
    audio.play();
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
              This watermark is barely noticeable and doesn't affect the translation quality.
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
                Click "End & Save Conversation" when the consultation is complete.
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
              This feature requires microphone access. If you see a permission prompt, please click "Allow".
            </p>
            <p className="text-blue-700 text-sm">
              If permission was denied, click the microphone icon in your browser's address bar and set it to "Allow".
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
```

---

## 4. Test Page (`src/app/test-voice-dubbing/page.tsx`)

```typescript
'use client';

import VoiceDubbingComponent from '@/components/VoiceDubbingComponent';

export default function VoiceDubbingTestPage() {
  return (
    <div>
      <VoiceDubbingComponent />
    </div>
  );
}
```

---

## 5. Mock Dubbing Service (`src/app/api/mock-dubbing/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const targetLanguage = formData.get('targetLanguage') as string;

    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'Audio file is required'
      }, { status: 400 });
    }

    if (!targetLanguage) {
      return NextResponse.json({
        success: false,
        error: 'Target language is required'
      }, { status: 400 });
    }

    // Mock dubbing response
    const mockDubbingId = `mock_${Date.now()}`;
    
    return NextResponse.json({
      success: true,
      dubbing: {
        dubbing_id: mockDubbingId,
        status: 'pending',
        target_lang: targetLanguage,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Mock dubbing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const dubbingId = searchParams.get('dubbingId');
  const targetLanguage = searchParams.get('targetLanguage');

  try {
    switch (action) {
      case 'status':
        if (!dubbingId) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID is required'
          }, { status: 400 });
        }

        // Mock status - always return 'dubbed' after a short delay
        const status = {
          dubbing_id: dubbingId,
          status: 'dubbed' as const,
          target_lang: targetLanguage || 'es',
          created_at: new Date().toISOString()
        };

        return NextResponse.json({
          success: true,
          status
        });

      case 'audio':
        if (!dubbingId || !targetLanguage) {
          return NextResponse.json({
            success: false,
            error: 'Dubbing ID and target language are required'
          }, { status: 400 });
        }

        // Mock audio - return a small audio file
        const mockAudioData = new Uint8Array(1024); // 1KB of mock audio
        const mockAudioBlob = new Blob([mockAudioData], { type: 'audio/mpeg' });
        
        return new NextResponse(mockAudioBlob, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="mock_dubbed_audio_${targetLanguage}.mp3"`
          }
        });

      case 'languages':
        const languages = [
          { code: 'es', name: 'Spanish' },
          { code: 'fr', name: 'French' },
          { code: 'de', name: 'German' },
          { code: 'it', name: 'Italian' },
          { code: 'pt', name: 'Portuguese' },
          { code: 'ar', name: 'Arabic' },
          { code: 'zh', name: 'Chinese' },
          { code: 'ja', name: 'Japanese' },
          { code: 'ko', name: 'Korean' },
          { code: 'hi', name: 'Hindi' },
          { code: 'en', name: 'English' }
        ];
        
        return NextResponse.json({
          success: true,
          languages
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: status, audio, or languages'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Mock API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

---

## 6. Mock Voice Dubbing Component (`src/components/MockVoiceDubbingComponent.tsx`)

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Play, Pause, Download, Languages, Volume2 } from 'lucide-react';

interface MockDubbingStatus {
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

export default function MockVoiceDubbingComponent() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dubbedAudioUrl, setDubbedAudioUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [dubbingStatus, setDubbingStatus] = useState<MockDubbingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTimestamp, setRecordingTimestamp] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load available languages
  const loadLanguages = useCallback(async () => {
    try {
      const response = await fetch('/api/mock-dubbing?action=languages');
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

  // Process mock dubbing
  const processMockDubbing = useCallback(async () => {
    if (!audioBlob) {
      setError('No audio recording available. Please record audio first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setDubbingStatus(null);
    setDubbedAudioUrl(null);

    try {
      console.log('Processing mock dubbing with audio blob size:', audioBlob.size);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('targetLanguage', targetLanguage);

      const response = await fetch('/api/mock-dubbing', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        console.log('Mock dubbing started successfully:', result.dubbing);
        setDubbingStatus(result.dubbing);
        
        // Simulate processing delay
        setTimeout(async () => {
          try {
            // Get mock status
            const statusResponse = await fetch(`/api/mock-dubbing?action=status&dubbingId=${result.dubbing.dubbing_id}&targetLanguage=${targetLanguage}`);
            const statusResult = await statusResponse.json();

            if (statusResult.success) {
              setDubbingStatus(statusResult.status);

              // Get mock audio
              const audioResponse = await fetch(`/api/mock-dubbing?action=audio&dubbingId=${result.dubbing.dubbing_id}&targetLanguage=${targetLanguage}`);
              if (audioResponse.ok) {
                const audioBlob = await audioResponse.blob();
                setDubbedAudioUrl(URL.createObjectURL(audioBlob));
                console.log('Mock dubbed audio downloaded successfully');
              }
            }
          } catch (err) {
            console.error('Mock dubbing completion error:', err);
            setError('Failed to complete mock dubbing');
          }
        }, 2000); // 2 second delay for mock processing
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to process mock dubbing');
      console.error('Mock dubbing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [audioBlob, targetLanguage]);

  // Play audio
  const playAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => setIsPlaying(false);
    
    audio.play();
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
            <h1 className="text-3xl font-bold text-gray-900">Mock Voice Dubbing Test</h1>
          </div>
          
          <p className="text-gray-600 mb-6">
            This is a mock version of the voice dubbing system for testing purposes.
          </p>

          {/* Mock Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Mock System Notice</h3>
            <p className="text-yellow-700 text-sm mb-2">
              This is a mock implementation that simulates the ElevenLabs dubbing process.
            </p>
            <p className="text-yellow-700 text-sm">
              This is a mock version. In the real implementation, this would be the translated audio.
            </p>
          </div>

          {/* Language Selection */}
          <div className="flex items-center space-x-4 mb-6">
            <Languages className="h-5 w-5 text-gray-500" />
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onFocus={loadLanguages}
            >
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

          {/* Mock Dubbing Button */}
          {audioBlob && (
            <div className="text-center">
              <button
                onClick={processMockDubbing}
                disabled={isProcessing}
                className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? 'Processing...' : `Mock Translate to ${languages.find(l => l.code === targetLanguage)?.name || targetLanguage}`}
              </button>
            </div>
          )}
        </div>

        {/* Mock Dubbing Status */}
        {dubbingStatus && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Mock Translation Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <span className="font-semibold">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  dubbingStatus.status === 'dubbed' ? 'bg-green-100 text-green-800' :
                  dubbingStatus.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                  dubbingStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {dubbingStatus.status}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <span className="font-semibold">Target Language:</span>
                <span>{dubbingStatus.target_lang}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <span className="font-semibold">Mock Dubbing ID:</span>
                <span className="text-sm font-mono">{dubbingStatus.dubbing_id}</span>
              </div>
            </div>
          </div>
        )}

        {/* Mock Dubbed Audio */}
        {dubbedAudioUrl && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Mock Dubbed Audio</h2>
            
            <div className="bg-green-100 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">Mock Translated Audio</h3>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => playAudio(dubbedAudioUrl)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={() => downloadAudio(dubbedAudioUrl, `mock_dubbed_audio_${targetLanguage}.mp3`)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
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
```

---

## 7. Mock Test Page (`src/app/test-mock-dubbing/page.tsx`)

```typescript
'use client';

import MockVoiceDubbingComponent from '@/components/MockVoiceDubbingComponent';

export default function MockVoiceDubbingTestPage() {
  return (
    <div>
      <MockVoiceDubbingComponent />
    </div>
  );
}
```

---

## Environment Variables Required

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

---

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

---

## Key Features

- **Continuous Conversations**: Start/end conversation sessions
- **Bidirectional Translation**: Support for multiple language pairs
- **Real-time Processing**: Status updates and progress indicators
- **Audio Management**: Play, pause, and download functionality
- **Error Handling**: Comprehensive error messages and fallbacks
- **Mock System**: For testing without API costs
- **Watermark Support**: ElevenLabs watermark handling for free tier
