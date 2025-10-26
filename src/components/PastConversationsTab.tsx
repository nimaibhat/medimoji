'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { VoiceConversationService } from '@/lib/voice-conversation-service';
import { VoiceTranslationSummary } from '@/types/voice-conversation';
import ConversationPlayer from './ConversationPlayer';
import { 
  User, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Languages, 
  CheckCircle, 
  AlertCircle,
  Eye,
  ArrowLeft,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface PastConversationsTabProps {
  onBack: () => void;
}

export default function PastConversationsTab({ onBack }: PastConversationsTabProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<VoiceTranslationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<VoiceTranslationSummary | null>(null);
  const [fullConversation, setFullConversation] = useState<VoiceTranslation | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await VoiceConversationService.getDoctorConversations(user!.uid);
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleViewConversation = async (conversation: VoiceTranslationSummary) => {
    try {
      setLoadingConversation(true);
      const fullConv = await VoiceConversationService.getConversation(conversation.id);
      if (fullConv) {
        setFullConversation(fullConv);
        setSelectedConversation(conversation);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
      setError('Failed to load conversation details');
    } finally {
      setLoadingConversation(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m` : '<1m';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'active':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'active':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  if (selectedConversation && fullConversation) {
    return (
      <ConversationPlayer
        conversation={fullConversation}
        onClose={() => {
          setSelectedConversation(null);
          setFullConversation(null);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-150"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Patient Conversations</h1>
              <p className="text-sm text-gray-600">Review past voice translation sessions</p>
            </div>
          </div>
          <button
            onClick={loadConversations}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading conversations...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">Unable to load conversations</p>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadConversations}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
              <p className="text-gray-600">Start a new voice translation session to see it here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer group"
                onClick={() => handleViewConversation(conversation)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-50 rounded-full p-3">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-150">
                          {conversation.patientName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {conversation.doctorName} • {conversation.visitType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(conversation.status)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(conversation.status)}`}>
                        {conversation.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(conversation.date)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeFromString(conversation.time)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MessageSquare className="h-4 w-4" />
                      <span>{conversation.exchangeCount} exchanges</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(conversation.totalDuration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Languages className="h-4 w-4 text-gray-400" />
                      <div className="flex space-x-1">
                        {conversation.languagePairs.map((pair, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md"
                          >
                            {pair}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewConversation(conversation);
                      }}
                      className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-150"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}