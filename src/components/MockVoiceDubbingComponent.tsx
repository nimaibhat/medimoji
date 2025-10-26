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
