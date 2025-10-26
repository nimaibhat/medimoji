'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Stethoscope,
  UserCircle2,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Clock,
  Plus,
  Trash2,
  FileText,
  Activity
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

  useEffect(() => {
    if (user && currentConversationId) {
      loadConversationHistory();
    }
  }, [currentConversationId, user]);

  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        loadConversationHistory();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadConversationHistory = async () => {
    if (!user) return;
    
    try {
      const conversations = await ConversationManager.getUserConversations(user.uid, 15);
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

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await ConversationManager.deleteConversation(conversationId);
      await loadConversationHistory();
      setShowDeleteConfirm(null);
      
      if (currentConversationId === conversationId && onNewConversation) {
        onNewConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateTitle = (title: string, maxLength: number = 32) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  if (isCollapsed) {
    return (
      <div className="h-screen w-16 bg-white border-r border-slate-200 flex flex-col items-center py-6">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#113B5C' }}>
            <img 
              src="/ohio_state_logo.png" 
              alt="Ohio State Logo" 
              className="h-8 w-8 object-contain"
            />
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggleCollapse(false)}
          className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors duration-200 mb-8"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* New Conversation */}
        <button
          onClick={onNewConversation}
          className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors duration-200 mb-auto"
          aria-label="New consultation"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Settings */}
        <button
          onClick={() => router.push('/settings')}
          className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors duration-200 mb-3"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors duration-200"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-80 bg-white border-r border-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#113B5C' }}>
            <img 
              src="/ohio_state_logo.png" 
              alt="Ohio State Logo" 
              className="h-8 w-8 object-contain"
            />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: '#113B5C' }}>Hack OHI/O</h1>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#76C5E0' }}>2025</p>
            </div>
          </div>
          <button
            onClick={() => onToggleCollapse(true)}
            className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors duration-200"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* New Consultation Button */}
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors duration-200 shadow-sm"
          style={{ backgroundColor: '#113B5C' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0F2A42'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#113B5C'}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          <span className="text-sm font-medium">New Consultation</span>
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center space-x-2 px-2 py-2 mb-4">
            <Clock className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Recent Consultations</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Activity className="h-5 w-5 text-slate-400 animate-pulse" strokeWidth={1.5} />
            </div>
          ) : conversationHistory.length === 0 ? (
            <div className="px-3 py-12 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-slate-500 font-medium">No consultations yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a new conversation</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversationHistory.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative rounded-lg transition-all duration-200 ${
                    currentConversationId === conversation.id
                      ? 'bg-slate-50 border border-slate-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <button
                    onClick={() => onConversationSelect?.(conversation.id)}
                    className="w-full text-left px-3 py-3"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`mt-0.5 ${
                        currentConversationId === conversation.id ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        <FileText className="h-4 w-4" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate leading-tight ${
                          currentConversationId === conversation.id ? 'text-slate-900' : 'text-slate-700'
                        }`}>
                          {truncateTitle(conversation.title)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          {formatTimestamp(conversation.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Delete Button */}
                  {showDeleteConfirm === conversation.id ? (
                    <div className="absolute right-2 top-2 flex items-center space-x-1">
                      <button
                        onClick={() => handleDeleteConversation(conversation.id)}
                        className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors duration-200"
                        aria-label="Confirm delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors duration-200"
                        aria-label="Cancel"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(conversation.id)}
                      className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Profile & Actions */}
      <div className="p-6 border-t border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCircle2 className="h-5 w-5 text-slate-600" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push('/settings')}
            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2.5 text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors duration-200"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}