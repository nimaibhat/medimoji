'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationProvider, useConversation } from '@/contexts/ConversationContext';
import { VoiceConversationProvider } from '@/contexts/VoiceConversationContext';
import LoginPage from '@/components/LoginPage';
import Sidebar from '@/components/Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState('assistant');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { currentConversationId, onConversationSelect, onNewConversation } = useConversation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen bg-white flex">
      <Sidebar 
        onAgentSelect={setSelectedAgent} 
        selectedAgent={selectedAgent}
        onToggleCollapse={setIsSidebarCollapsed}
        isCollapsed={isSidebarCollapsed}
        onConversationSelect={onConversationSelect}
        onNewConversation={onNewConversation}
        currentConversationId={currentConversationId}
      />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-16' : 'ml-80'
      }`}>
        {children}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ConversationProvider>
      <VoiceConversationProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </VoiceConversationProvider>
    </ConversationProvider>
  );
}
