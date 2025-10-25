'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ConversationContextType {
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const onConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const onNewConversation = () => {
    setCurrentConversationId('new');
  };

  return (
    <ConversationContext.Provider value={{
      currentConversationId,
      setCurrentConversationId,
      onConversationSelect,
      onNewConversation
    }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}
