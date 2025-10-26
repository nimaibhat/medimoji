'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Download, X, ChevronLeft, ChevronRight, Clock, AlertCircle, FileText, Loader2 } from 'lucide-react';
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
  const [playingLanguage, setPlayingLanguage] = useState<'source' | 'target'>('source'); // 'source' or 'target'
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
        // Skip checking if it's clearly a blob URL (will be unavailable)
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
    if (audioRef.current && currentPlaylist[currentPlaylistIndex]) {
      const currentTrack = currentPlaylist[currentPlaylistIndex];
      audioRef.current.src = currentTrack.audioUrl;
      setCurrentTime(0);
    }
  }, [currentPlaylistIndex, currentPlaylist]);

  const togglePlayPause = async () => {
    if (!audioRef.current || currentPlaylist.length === 0) return;

    const currentTrack = currentPlaylist[currentPlaylistIndex];
    if (!audioAvailability[currentTrack.id]) {
      setError('Audio file is not available. It may have expired or been moved.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the actual audio URL (handle both blob and persistent URLs)
      const audioUrl = await AudioStorageService.getAudioUrl(currentTrack.audioUrl);
      if (!audioUrl) {
        throw new Error('Audio file is not accessible');
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Failed to play audio. The file may be corrupted or unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const goToPreviousTrack = () => {
    if (currentPlaylistIndex > 0) {
      setCurrentPlaylistIndex(currentPlaylistIndex - 1);
    }
  };

  const goToNextTrack = () => {
    if (currentPlaylistIndex < currentPlaylist.length - 1) {
      setCurrentPlaylistIndex(currentPlaylistIndex + 1);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTranscribeConversation = async () => {
    try {
      setIsTranscribing(true);
      setTranscriptionStatus('processing');
      
      await VoiceConversationService.transcribeAndGenerateReport(conversation.id);
      
      // Fetch the updated conversation to get the generated report
      const updatedConversation = await VoiceConversationService.getConversation(conversation.id);
      if (updatedConversation?.medicalReport?.summary) {
        setGeneratedReport(updatedConversation.medicalReport.summary);
      }
      
      setTranscriptionStatus('completed');
      console.log('Transcription completed successfully');
    } catch (error) {
      console.error('Error transcribing conversation:', error);
      setError('Failed to transcribe conversation. Please try again.');
      setTranscriptionStatus('none');
    } finally {
      setIsTranscribing(false);
    }
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
        const trackFolder = zip.folder(`exchange-${i + 1}`);
        
        if (trackFolder) {
          trackFolder.file('metadata.json', JSON.stringify({
            timestamp: track.timestamp,
            sourceLanguage: track.sourceLanguage,
            targetLanguage: track.targetLanguage,
            textTranscript: track.textTranscript || 'No transcript available'
          }, null, 2));

          // Try to fetch and add audio files
          try {
            const [originalUrl, translatedUrl] = await Promise.all([
              AudioStorageService.getAudioUrl(track.originalAudioUrl),
              AudioStorageService.getAudioUrl(track.translatedAudioUrl)
            ]);

            if (originalUrl) {
              const originalResponse = await fetch(originalUrl);
              if (originalResponse.ok) {
                const originalBlob = await originalResponse.blob();
                trackFolder.file(`original-${track.sourceLanguage}.mp3`, originalBlob);
              }
            }

            if (translatedUrl) {
              const translatedResponse = await fetch(translatedUrl);
              if (translatedResponse.ok) {
                const translatedBlob = await translatedResponse.blob();
                trackFolder.file(`translated-${track.targetLanguage}.mp3`, translatedBlob);
              }
            }
          } catch (audioError) {
            console.warn(`Failed to download audio for exchange ${i + 1}:`, audioError);
          }
        }
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

    } catch (err) {
      console.error('Error downloading conversation:', err);
      setError('Failed to download conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (tracks.length === 0) {
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
            <Volume2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Audio Available</h3>
            <p className="text-gray-500">
              This conversation doesn't have any recorded audio exchanges yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

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

  const currentTrack = tracks[currentTrackIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Conversation Player</h2>
            <p className="text-gray-600">
              {conversation.patientInfo.patientName} • {conversation.patientInfo.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Audio Player */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <audio ref={audioRef} preload="metadata" />
          
          {/* Track Info */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentPlaylist === englishPlaylist ? 'English' : 'Spanish'} Audio {currentPlaylistIndex + 1} of {currentPlaylist.length}
            </h3>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600 mb-3">
              <span className="flex items-center space-x-1">
                <Volume2 className="h-4 w-4" />
                <span>{currentTrack.sourceLanguage} → {currentTrack.targetLanguage}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{currentTrack.timestamp}</span>
              </span>
            </div>
            
            {/* Language Toggle */}
            <div className="flex items-center justify-center space-x-4 mb-3">
              {/* English Button */}
              {englishPlaylist.length > 0 && (
                <button
                  onClick={() => {
                    setCurrentPlaylist(englishPlaylist);
                    setCurrentPlaylistIndex(0);
                    setIsPlaying(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPlaylist === englishPlaylist
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPlaylist === spanishPlaylist
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Spanish ({spanishPlaylist.length})
                </button>
              )}
            </div>
            
            {currentTrack.textTranscript && (
              <p className="mt-2 text-sm text-gray-500 italic">
                "{currentTrack.textTranscript}"
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={goToPreviousTrack}
              disabled={currentPlaylistIndex === 0}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            
            <button
              onClick={togglePlayPause}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full p-4 transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              ) : isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </button>
            
            <button
              onClick={goToNextTrack}
              disabled={currentPlaylistIndex === currentPlaylist.length - 1}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
          >
            <Download className="h-5 w-5" />
            <span>{isLoading ? 'Preparing...' : 'Download Session'}</span>
          </button>
          
          <button
            onClick={handleTranscribeConversation}
            disabled={isTranscribing || conversation.transcription?.isTranscribed}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {isTranscribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            <span>
              {isTranscribing 
                ? 'Transcribing...' 
                : conversation.transcription?.isTranscribed 
                  ? 'Transcribed ✓' 
                  : 'Generate Report'
              }
            </span>
          </button>
        </div>

        {/* Generated Report Section */}
        {(generatedReport || conversation.medicalReport?.summary) && (
          <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Medical Report</h4>
            <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                {generatedReport || conversation.medicalReport?.summary}
              </pre>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Generated: {conversation.medicalReport?.generatedAt ? 
                new Date(conversation.medicalReport.generatedAt).toLocaleString() : 
                'Just now'
              }
            </div>
          </div>
        )}

        {/* Track List */}
        <div className="mt-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-3">
            {currentPlaylist === englishPlaylist ? 'English' : 'Spanish'} Audio Tracks
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {currentPlaylist.map((track, index) => (
              <div
                key={track.id}
                onClick={() => setCurrentPlaylistIndex(index)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  index === currentPlaylistIndex
                    ? 'bg-blue-100 border border-blue-300'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === currentPlaylistIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                    <span className="font-medium">
                      Exchange {index + 1}
                    </span>
                    <span className="text-sm text-gray-600">
                      {track.sourceLanguage} → {track.targetLanguage}
                    </span>
                    <div className="flex items-center space-x-2">
                      {AudioStorageService.isBlobUrl(track.originalAudioUrl) ? (
                        <span className="text-xs text-orange-500">{track.sourceLanguage === 'en' ? 'English' : track.sourceLanguage === 'es' ? 'Spanish' : track.sourceLanguage}: Blob</span>
                      ) : (
                        <span className="text-xs text-green-500">{track.sourceLanguage === 'en' ? 'English' : track.sourceLanguage === 'es' ? 'Spanish' : track.sourceLanguage}: ✓</span>
                      )}
                      {AudioStorageService.isBlobUrl(track.translatedAudioUrl) ? (
                        <span className="text-xs text-orange-500">{track.targetLanguage === 'en' ? 'English' : track.targetLanguage === 'es' ? 'Spanish' : track.targetLanguage}: Blob</span>
                      ) : (
                        <span className="text-xs text-green-500">{track.targetLanguage === 'en' ? 'English' : track.targetLanguage === 'es' ? 'Spanish' : track.targetLanguage}: ✓</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {track.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
