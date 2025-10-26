'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Play, Download, Archive, Eye, Volume2 } from 'lucide-react';
import { useVoiceConversation } from '@/contexts/VoiceConversationContext';
import { useAuth } from '@/contexts/AuthContext';
import { VoiceConversationSummary } from '@/types/voice-conversation';

export default function VoiceConversationHistory() {
  const { user } = useAuth();
  const { 
    conversations, 
    loadConversations, 
    archiveConversation,
    isLoading,
    error 
  } = useVoiceConversation();

  const [selectedConversation, setSelectedConversation] = useState<VoiceConversationSummary | null>(null);

  useEffect(() => {
    if (user?.uid) {
      loadConversations(user.uid);
    }
  }, [user?.uid, loadConversations]);

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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-4 text-gray-600">Loading conversations...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <Volume2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Voice Conversation History</h1>
          </div>
          
          <p className="text-gray-600">
            View and manage all your voice translation sessions with patients.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Conversations List */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <Volume2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Conversations Yet</h3>
              <p className="text-gray-500">
                Start a new voice translation session to see your conversations here.
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
                          <span className="text-gray-600">Patient ID:</span>
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
                        <button className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                          <Play className="h-3 w-3" />
                          <span>Play Session</span>
                        </button>
                        <button className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors">
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
      </div>
    </div>
  );
}
