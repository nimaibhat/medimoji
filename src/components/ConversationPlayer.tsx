'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  AlertCircle, 
  FileText, 
  Loader2,
  Volume2,
  Languages,
  User,
  Calendar,
  MessageSquare,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { VoiceTranslation } from '@/types/voice-conversation';
import { VoiceConversationService } from '@/lib/voice-conversation-service';
import { AudioStorageService } from '@/lib/audio-storage-service';

interface ConversationPlayerProps {
  conversation: VoiceTranslation;
  onClose: () => void;
}

interface AudioTrack {
  id: string;
  timestamp: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalAudioUrl: string;
  translatedAudioUrl: string;
  textTranscript?: string;
}

export default function ConversationPlayer({ conversation, onClose }: ConversationPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioAvailability, setAudioAvailability] = useState<Record<string, boolean>>({});
  const [playingLanguage, setPlayingLanguage] = useState<'source' | 'target'>('source');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'none' | 'processing' | 'completed'>('none');
  const [generatedReport, setGeneratedReport] = useState<string | null>(
    conversation.medicalReport?.summary || null
  );
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const tracks: AudioTrack[] = conversation.translations || [];

  // Create language-based playlists
  const createLanguagePlaylist = (language: string) => {
    return tracks
      .map(track => {
        if (track.sourceLanguage === language) {
          return { ...track, audioUrl: track.originalAudioUrl, isOriginal: true };
        } else if (track.targetLanguage === language) {
          return { ...track, audioUrl: track.translatedAudioUrl, isOriginal: false };
        }
        return null;
      })
      .filter(Boolean);
  };

  const englishPlaylist = createLanguagePlaylist('en');
  const spanishPlaylist = createLanguagePlaylist('es');
  
  const [currentPlaylist, setCurrentPlaylist] = useState<typeof englishPlaylist>(englishPlaylist);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);

  useEffect(() => {
    // Check audio availability for all tracks
    const checkAudioAvailability = async () => {
      const availability: Record<string, boolean> = {};
      for (const track of tracks) {
        if (AudioStorageService.isBlobUrl(track.originalAudioUrl) || AudioStorageService.isBlobUrl(track.translatedAudioUrl)) {
          availability[track.id] = false;
          continue;
        }
        
        const originalAvailable = await AudioStorageService.getAudioUrl(track.originalAudioUrl);
        const translatedAvailable = await AudioStorageService.getAudioUrl(track.translatedAudioUrl);
        availability[track.id] = !!(originalAvailable && translatedAvailable);
      }
      setAudioAvailability(availability);
    };

    if (tracks.length > 0) {
      checkAudioAvailability();
    }
  }, [tracks]);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration);
      const handleEnded = () => {
        setIsPlaying(false);
        if (currentPlaylistIndex < currentPlaylist.length - 1) {
          setCurrentPlaylistIndex(currentPlaylistIndex + 1);
        }
      };

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [currentPlaylistIndex, currentPlaylist.length]);

  useEffect(() => {
    if (currentPlaylist.length > 0 && currentPlaylistIndex < currentPlaylist.length) {
      const currentTrack = currentPlaylist[currentPlaylistIndex];
      if (audioRef.current && currentTrack) {
        audioRef.current.src = currentTrack.audioUrl;
        audioRef.current.load();
      }
    }
  }, [currentPlaylist, currentPlaylistIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Stop any other audio playing in the app
        const allAudioElements = document.querySelectorAll('audio');
        allAudioElements.forEach(audio => {
          if (audio !== audioRef.current && !audio.paused) {
            audio.pause();
          }
        });
        
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio');
      setIsPlaying(false);
    }
  };

  const goToPreviousTrack = () => {
    if (currentPlaylistIndex > 0) {
      setCurrentPlaylistIndex(currentPlaylistIndex - 1);
      setIsPlaying(false);
    }
  };

  const goToNextTrack = () => {
    if (currentPlaylistIndex < currentPlaylist.length - 1) {
      setCurrentPlaylistIndex(currentPlaylistIndex + 1);
      setIsPlaying(false);
    }
  };

  const formatAudioTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create a zip file with all audio files and conversation details
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add conversation metadata (HIPAA compliant - no patient names)
      const metadata = {
        sessionId: conversation.id,
        patientId: conversation.patientInfo.patientId || 'Not provided',
        doctorName: conversation.patientInfo.doctorName,
        date: conversation.patientInfo.date,
        time: conversation.patientInfo.time,
        visitType: conversation.patientInfo.visitType,
        totalDuration: conversation.sessionInfo.totalDuration,
        exchangeCount: conversation.sessionInfo.exchangeCount,
        languagePairs: conversation.sessionInfo.languagePairs,
        createdAt: conversation.metadata.createdAt,
        hipaaCompliant: true,
        note: 'This report is HIPAA compliant and does not contain patient names'
      };

      zip.file('conversation-metadata.json', JSON.stringify(metadata, null, 2));

      // Add each translation as a folder
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const exchangeFolder = zip.folder(`exchange-${i + 1}`);

        try {
          // Add original audio
          const originalResponse = await fetch(track.originalAudioUrl);
          if (originalResponse.ok) {
            const originalBlob = await originalResponse.blob();
            exchangeFolder?.file(`original-${track.sourceLanguage}.mp3`, originalBlob);
          }
        } catch (error) {
          console.warn(`Failed to download original audio for exchange ${i + 1}:`, error);
        }

        try {
          // Add translated audio
          const translatedResponse = await fetch(track.translatedAudioUrl);
          if (translatedResponse.ok) {
            const translatedBlob = await translatedResponse.blob();
            exchangeFolder?.file(`translated-${track.targetLanguage}.mp3`, translatedBlob);
          }
        } catch (error) {
          console.warn(`Failed to download translated audio for exchange ${i + 1}:`, error);
        }

        // Add exchange metadata
        const exchangeMetadata = {
          timestamp: track.timestamp,
          sourceLanguage: track.sourceLanguage,
          targetLanguage: track.targetLanguage,
          textTranscript: track.textTranscript || 'Not available'
        };
        exchangeFolder?.file('metadata.json', JSON.stringify(exchangeMetadata, null, 2));
      }

      // Generate and download the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${conversation.id}-${conversation.patientInfo.patientName.replace(/\s+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading conversation:', error);
      setError('Failed to download conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscribeConversation = async () => {
    try {
      setIsTranscribing(true);
      setTranscriptionStatus('processing');
      
      await VoiceConversationService.transcribeAndGenerateReport(conversation.id);
      
      // Fetch updated conversation to get the generated report
      const updatedConversation = await VoiceConversationService.getConversation(conversation.id);
      if (updatedConversation?.medicalReport?.summary) {
        setGeneratedReport(updatedConversation.medicalReport.summary);
      }
      
      setTranscriptionStatus('completed');
    } catch (error) {
      console.error('Error transcribing conversation:', error);
      setError('Failed to generate medical report');
      setTranscriptionStatus('none');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDateFromString = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeFromString = (timeString: string) => {
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Check if all tracks have unavailable audio (likely old blob URLs)
  const allTracksUnavailable = tracks.every(track => !audioAvailability[track.id]);
  
  if (allTracksUnavailable) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Conversation Player</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-orange-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Audio Not Available</h3>
            <p className="text-gray-500 mb-4">
              This conversation was recorded before we implemented persistent audio storage. 
              The audio files are no longer accessible.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-blue-800 mb-2">What you can still access:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Patient information and visit details</li>
                <li>• Conversation timestamps and duration</li>
                <li>• Language pairs used</li>
                <li>• Number of exchanges</li>
                <li>• Download session metadata</li>
              </ul>
            </div>
            <div className="mt-6">
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Download Session Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Conversation Player</h2>
            <p className="text-gray-600">
              {conversation.patientInfo.patientName} • {formatDateFromString(conversation.patientInfo.date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Session Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Patient</p>
                <p className="text-sm font-medium text-gray-900">{conversation.patientInfo.patientName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDateFromString(conversation.patientInfo.date)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Exchanges</p>
                <p className="text-sm font-medium text-gray-900">{conversation.sessionInfo.exchangeCount}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-medium text-gray-900">{Math.round(conversation.sessionInfo.totalDuration / 60)}m</p>
              </div>
            </div>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          {/* English Button */}
          {englishPlaylist.length > 0 && (
            <button
              onClick={() => {
                setCurrentPlaylist(englishPlaylist);
                setCurrentPlaylistIndex(0);
                setIsPlaying(false);
              }}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                currentPlaylist === englishPlaylist
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Languages className="h-4 w-4 inline mr-2" />
              English ({englishPlaylist.length})
            </button>
          )}
          
          {/* Spanish Button */}
          {spanishPlaylist.length > 0 && (
            <button
              onClick={() => {
                setCurrentPlaylist(spanishPlaylist);
                setCurrentPlaylistIndex(0);
                setIsPlaying(false);
              }}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                currentPlaylist === spanishPlaylist
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Languages className="h-4 w-4 inline mr-2" />
              Spanish ({spanishPlaylist.length})
            </button>
          )}
        </div>

        {/* Audio Player */}
        {currentPlaylist.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={goToPreviousTrack}
                  disabled={currentPlaylistIndex === 0}
                  className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <button
                  onClick={togglePlayPause}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                
                <button
                  onClick={goToNextTrack}
                  disabled={currentPlaylistIndex === currentPlaylist.length - 1}
                  className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              
              <div className="text-sm text-gray-600">
                {currentPlaylistIndex + 1} of {currentPlaylist.length}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{formatAudioTime(currentTime)}</span>
                <span>{formatAudioTime(duration)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Current Track Info */}
            {currentPlaylist[currentPlaylistIndex] && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {currentPlaylist[currentPlaylistIndex].timestamp}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Medical Report Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Medical Report</h3>
            <button
              onClick={handleTranscribeConversation}
              disabled={isTranscribing || transcriptionStatus === 'completed'}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : transcriptionStatus === 'completed' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span>
                {isTranscribing ? 'Generating...' : 
                 transcriptionStatus === 'completed' ? 'Report Generated' : 
                 'Generate Report'}
              </span>
            </button>
          </div>

          {generatedReport && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Medical Summary</span>
                <span className="text-xs text-gray-500">
                  Generated: {conversation.medicalReport?.generatedAt ? 
                    new Date(conversation.medicalReport.generatedAt).toLocaleString() : 
                    'Just now'}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {generatedReport}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className={`w-3 h-3 rounded-full ${
                  audioAvailability[track.id] ? 'bg-green-400' : 'bg-gray-300'
                }`}
                title={`Exchange ${index + 1}: ${audioAvailability[track.id] ? 'Available' : 'Unavailable'}`}
              />
            ))}
          </div>
          
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>Download Session</span>
          </button>
        </div>

        {/* Hidden Audio Element */}
        <audio ref={audioRef} preload="metadata" />
      </div>
    </div>
  );
}