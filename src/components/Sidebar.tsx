'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  History,
  Clock,
  Plus,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationManager, Conversation } from '@/lib/conversation-manager';

interface SidebarProps {
  onAgentSelect: (agent: string) => void;
  selectedAgent: string;
  onToggleCollapse: (isCollapsed: boolean) => void;
  isCollapsed: boolean;
  onConversationSelect?: (conversationId: string) => void;
  onNewConversation?: () => void;
  currentConversationId?: string | null;
}

// Using Conversation type from conversation-manager

export default function Sidebar({ 
  onAgentSelect, 
  selectedAgent, 
  onToggleCollapse, 
  isCollapsed,
  onConversationSelect,
  onNewConversation,
  currentConversationId
}: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [conversationHistory, setConversationHistory] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);



  useEffect(() => {
    if (user) {
      loadConversationHistory();
    }
  }, [user]);

  // Refresh conversation list when current conversation changes
  useEffect(() => {
    if (user && currentConversationId) {
      loadConversationHistory();
    }
  }, [currentConversationId, user]);

  // Refresh conversation list periodically to catch title updates
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        loadConversationHistory();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [user]);

  const loadConversationHistory = async () => {
    if (!user) return;
    
    try {
      const conversations = await ConversationManager.getUserConversations(user.uid, 10);
      setConversationHistory(conversations);
    } catch (error) {
      console.error('Error loading conversation history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const truncateMessage = (message: string, maxLength: number = 30) => {
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  const handleConversationClick = (conversation: Conversation) => {
    // Switch to the agent and load the conversation
    onAgentSelect(conversation.agent);
    if (onConversationSelect) {
      onConversationSelect(conversation.id);
    }
  };

  const handleNewConversation = () => {
    if (onNewConversation) {
      onNewConversation();
    }
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ConversationManager.deleteConversation(conversationId);
      setConversationHistory(prev => prev.filter(conv => conv.id !== conversationId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleCleanupConversations = async () => {
    if (!user) return;
    try {
      await ConversationManager.cleanupEmptyConversations(user.uid);
      await loadConversationHistory(); // Refresh the list
    } catch (error) {
      console.error('Error cleaning up conversations:', error);
    }
  };

  const confirmDelete = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(conversationId);
  };

  return (
    <div className={`bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300 fixed left-0 top-0 z-10 ${
      isCollapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Fixed Top Section - Ohio State Logo and Settings */}
      <div className="p-4 flex-shrink-0">
        {/* Ohio State Logo and Title */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center space-x-2">
            <img 
              src="/ohio_state_logo.png" 
              alt="Ohio State Logo" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center" style={{ display: 'none' }}>
              <span className="text-white font-bold text-xs">OSU</span>
            </div>
            {!isCollapsed && (
              <div className="text-center">
                <h1 className="text-lg font-bold text-gray-900">Hack OHI/O 2025</h1>
              </div>
            )}
          </div>
        </div>

        {/* Settings Icon - Always visible */}
        <div className="flex justify-center">
          <button 
            onClick={() => router.push('/settings')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Settings className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Main Content Area - Only visible when expanded */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col min-h-0 pb-32">
          {/* Fixed Conversation History Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Recent Conversations</span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleCleanupConversations}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Clean up empty conversations"
                >
                  <Trash2 className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  onClick={handleNewConversation}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="New Conversation"
                >
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
            
          {/* Scrollable Conversation List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : conversationHistory.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversationHistory.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group relative w-full text-left p-3 rounded-lg transition-colors hover:bg-gray-50 ${
                      currentConversationId === conversation.id ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleConversationClick(conversation)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              {conversation.agent}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTime(conversation.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 truncate">
                            {truncateMessage(conversation.title)}
                          </p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Delete button - only show on hover */}
                    <button
                      onClick={(e) => confirmDelete(conversation.id, e)}
                      className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                    
                    {/* Delete confirmation */}
                    {showDeleteConfirm === conversation.id && (
                      <div className="absolute top-0 left-0 right-0 bg-white border border-red-200 rounded-lg p-2 shadow-lg z-10">
                        <p className="text-xs text-red-600 mb-2">Delete this conversation?</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => handleDeleteConversation(conversation.id, e)}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(null);
                            }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            Cancel
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
      )}

      {/* Fixed Bottom Section - User Profile and Toggle */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-50 p-4 border-t border-gray-200">
        <div className="flex flex-col items-center space-y-3">
          {/* User Profile - Always visible */}
          <div className="flex items-center space-x-3 w-full">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4 text-gray-600" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email || 'No email'}
                </p>
              </div>
            )}
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => onToggleCollapse(!isCollapsed)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {/* Logout - Always visible at bottom */}
          <div className="w-full pt-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'space-x-3 p-3'} rounded-lg hover:bg-red-100 text-red-700`}
            >
              <LogOut className={`${isCollapsed ? 'h-8 w-8' : 'h-5 w-5'}`} />
              {!isCollapsed && <span className="text-sm">Logout</span>}
            </button>
          </div>
        </div>

        {/* Red line at bottom */}
        <div className="w-full h-0.5 bg-red-600 mt-4"></div>
      </div>
    </div>
  );
}