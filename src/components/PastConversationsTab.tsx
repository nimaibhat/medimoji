'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Play, Download, Archive, Eye, Volume2, ArrowLeft, MessageSquare } from 'lucide-react';
import { useVoiceConversation } from '@/contexts/VoiceConversationContext';
import { useAuth } from '@/contexts/AuthContext';
import { VoiceTranslationSummary, VoiceTranslation } from '@/types/voice-conversation';
import { VoiceConversationService } from '@/lib/voice-conversation-service';
import ConversationPlayer from './ConversationPlayer';

interface PastConversationsTabProps {
  onBack: () => void;
}

export default function PastConversationsTab({ onBack }: PastConversationsTabProps) {
  const { user } = useAuth();
  const { 
    conversations, 
    loadConversations, 
    archiveConversation,
    isLoading,
    error 
  } = useVoiceConversation();

  const [selectedConversation, setSelectedConversation] = useState<VoiceTranslationSummary | null>(null);
  const [playingConversation, setPlayingConversation] = useState<VoiceTranslation | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadConversations(user.uid);
    }
  }, [user?.uid, loadConversations]);

  const handlePlaySession = async (conversationId: string) => {
    try {
      setIsLoadingConversation(true);
      const fullConversation = await VoiceConversationService.getConversationForPlayback(conversationId);
      if (fullConversation) {
        setPlayingConversation(fullConversation);
      } else {
        console.error('Failed to load conversation for playback');
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (confirm('Are you sure you want to archive this conversation?')) {
      try {
        await archiveConversation(conversationId);
      } catch (err) {
        console.error('Failed to archive conversation:', err);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-gray-600">Loading conversations...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Past Conversations</h2>
        </div>
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Conversations List */}
        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <Volume2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Past Conversations</h3>
            <p className="text-gray-500">
              Your voice translation sessions will appear here once you complete them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 rounded-full p-3">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {conversation.patientName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {conversation.doctorName} • {conversation.visitType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(conversation.status)}`}>
                      {conversation.status}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setSelectedConversation(conversation)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {conversation.status !== 'archived' && (
                        <button
                          onClick={() => handleArchiveConversation(conversation.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Archive Conversation"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(conversation.date)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{conversation.time}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Volume2 className="h-4 w-4" />
                    <span>{conversation.exchangeCount} exchanges</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{Math.round(conversation.totalDuration / 60)} min</span>
                  </div>
                </div>

                {/* Language Pairs */}
                {conversation.languagePairs.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">Languages:</span>
                      <div className="flex flex-wrap gap-1">
                        {conversation.languagePairs.map((pair, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {pair}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conversation Details Modal */}
                {selectedConversation?.id === conversation.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">Conversation Details</h4>
                      <button
                        onClick={() => setSelectedConversation(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Session ID:</span>
                        <span className="font-medium">{conversation.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">{formatDate(conversation.createdAt)} at {formatTime(conversation.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Duration:</span>
                        <span className="font-medium">{Math.round(conversation.totalDuration / 60)} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Exchange Count:</span>
                        <span className="font-medium">{conversation.exchangeCount}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center space-x-2">
                      <button 
                        onClick={() => handlePlaySession(conversation.id)}
                        disabled={isLoadingConversation}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        <span>{isLoadingConversation ? 'Loading...' : 'Play Session'}</span>
                      </button>
                      <button 
                        onClick={() => handlePlaySession(conversation.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation Player Modal */}
      {playingConversation && (
        <ConversationPlayer
          conversation={playingConversation}
          onClose={() => setPlayingConversation(null)}
        />
      )}
    </div>
  );
}
