'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { VoiceConversationService } from '@/lib/voice-conversation-service';
import { VoiceTranslation, VoiceTranslationSummary } from '@/types/voice-conversation';

interface VoiceConversationContextType {
  currentConversationId: string | null;
  currentPatientInfo: VoiceTranslation['patientInfo'] | null;
  conversations: VoiceTranslationSummary[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startNewConversation: (patientInfo: VoiceTranslation['patientInfo'], doctorId: string) => Promise<string>;
  addTranslation: (translation: VoiceTranslation['translations'][0]) => Promise<void>;
  completeConversation: () => Promise<void>;
  loadConversations: (doctorId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  clearCurrentConversation: () => void;
  setError: (error: string | null) => void;
}

const VoiceConversationContext = createContext<VoiceConversationContextType | undefined>(undefined);

interface VoiceConversationProviderProps {
  children: ReactNode;
}

export function VoiceConversationProvider({ children }: VoiceConversationProviderProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentPatientInfo, setCurrentPatientInfo] = useState<VoiceTranslation['patientInfo'] | null>(null);
  const [conversations, setConversations] = useState<VoiceTranslationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNewConversation = useCallback(async (
    patientInfo: VoiceTranslation['patientInfo'],
    doctorId: string
  ): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const conversationId = await VoiceConversationService.createConversation(patientInfo, doctorId);
      
      setCurrentConversationId(conversationId);
      setCurrentPatientInfo(patientInfo);
      
      return conversationId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addTranslation = useCallback(async (
    translation: VoiceTranslation['translations'][0]
  ): Promise<void> => {
    if (!currentConversationId) {
      throw new Error('No active translation session');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await VoiceConversationService.addTranslation(currentConversationId, translation);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add translation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId]);

  const completeConversation = useCallback(async (): Promise<void> => {
    if (!currentConversationId) {
      throw new Error('No active conversation');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await VoiceConversationService.completeConversation(currentConversationId);
      
      // Refresh conversations list
      if (currentPatientInfo) {
        // Assuming we have doctorId from auth context
        // await loadConversations(doctorId);
      }
      
      clearCurrentConversation();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete conversation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, currentPatientInfo]);

  const loadConversations = useCallback(async (doctorId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const doctorConversations = await VoiceConversationService.getDoctorConversations(doctorId);
      setConversations(doctorConversations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const archiveConversation = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await VoiceConversationService.archiveConversation(conversationId);
      
      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive conversation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCurrentConversation = useCallback(() => {
    setCurrentConversationId(null);
    setCurrentPatientInfo(null);
  }, []);

  const value: VoiceConversationContextType = {
    currentConversationId,
    currentPatientInfo,
    conversations,
    isLoading,
    error,
    startNewConversation,
    addTranslation,
    completeConversation,
    loadConversations,
    archiveConversation,
    clearCurrentConversation,
    setError
  };

  return (
    <VoiceConversationContext.Provider value={value}>
      {children}
    </VoiceConversationContext.Provider>
  );
}

export function useVoiceConversation() {
  const context = useContext(VoiceConversationContext);
  if (context === undefined) {
    throw new Error('useVoiceConversation must be used within a VoiceConversationProvider');
  }
  return context;
}
