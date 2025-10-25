import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs
} from 'firebase/firestore';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  agent?: string;
  needsAuthorization?: boolean;
  authorizationUrl?: string;
  toolName?: string;
  imageUrl?: string;
  imageDescription?: string;
  imageStyle?: string;
  revisedPrompt?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  agent: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationManager {
  /**
   * Create a new conversation
   */
  static async createConversation(
    userId: string, 
    agent: string, 
    initialMessage?: string
  ): Promise<string> {
    const conversationData = {
      userId,
      title: initialMessage ? this.generateTitle(initialMessage) : `New ${agent} conversation`,
      agent,
      messages: initialMessage ? [{
        id: Date.now().toString(),
        content: initialMessage,
        role: 'user' as const,
        timestamp: new Date(),
        agent
      }] : [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    return docRef.id;
  }

  /**
   * Create a new conversation for user and agent (always creates new)
   */
  static async createNewConversation(
    userId: string, 
    agent: string
  ): Promise<string> {
    return await this.createConversation(userId, agent);
  }

  /**
   * Create a conversation with an initial message
   */
  static async createConversationWithMessage(
    userId: string, 
    agent: string, 
    initialMessage: Message
  ): Promise<string> {
    const title = initialMessage.role === 'user' 
      ? await this.generateTitle(initialMessage.content) 
      : `New ${agent} conversation`;

    const conversationData = {
      userId,
      title,
      agent,
      messages: [initialMessage],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    return docRef.id;
  }

  /**
   * Add a message to a conversation
   */
  static async addMessage(
    conversationId: string, 
    message: Omit<Message, 'id' | 'timestamp'>
  ): Promise<void> {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }

    const conversationData = conversationSnap.data();
    
    // Filter out undefined values from the message
    const cleanMessage = Object.fromEntries(
      Object.entries(message).filter(([, value]) => value !== undefined)
    );
    
    const newMessage: Message = {
      ...cleanMessage,
      id: Date.now().toString(),
      timestamp: new Date()
    } as Message;

    const updatedMessages = [...conversationData.messages, newMessage];
    
    // Generate title if this is the first user message
    let newTitle = conversationData.title;
    if (conversationData.messages.length === 0 && message.role === 'user') {
      newTitle = await this.generateTitle(message.content);
    }

    await updateDoc(conversationRef, {
      messages: updatedMessages,
      updatedAt: new Date(),
      title: newTitle
    });
  }

  /**
   * Get conversation by ID
   */
  static async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      return null;
    }

    const data = conversationSnap.data();
    return {
      id: conversationSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      messages: data.messages.map((msg: { timestamp: { toDate: () => Date }; [key: string]: unknown }) => ({
        ...msg,
        timestamp: msg.timestamp.toDate()
      }))
    } as Conversation;
  }

  /**
   * Get user's recent conversations
   */
  static async getUserConversations(
    userId: string, 
    limitCount: number = 10
  ): Promise<Conversation[]> {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        messages: data.messages.map((msg: { timestamp: { toDate: () => Date }; [key: string]: unknown }) => ({
          ...msg,
          timestamp: msg.timestamp.toDate()
        }))
      } as Conversation;
    });
  }

  /**
   * Update conversation title
   */
  static async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      title,
      updatedAt: new Date()
    });
  }

  /**
   * Generate and update conversation title based on first user message
   */
  static async generateAndUpdateTitle(conversationId: string, message: string): Promise<void> {
    try {
      const title = await this.generateTitle(message);
      await this.updateConversationTitle(conversationId, title);
    } catch (error) {
      console.error('Error generating and updating title:', error);
    }
  }

  /**
   * Delete a conversation
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    const conversationRef = doc(db, 'conversations', conversationId);
    await deleteDoc(conversationRef);
  }

  /**
   * Generate a title from the first message using LLM
   */
  private static async generateTitle(message: string): Promise<string> {
    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate title');
      }

      const data = await response.json();
      return data.title || this.generateSimpleTitle(message);
    } catch (error) {
      console.error('Error generating title with LLM:', error);
      return this.generateSimpleTitle(message);
    }
  }

  /**
   * Fallback simple title generation
   */
  private static generateSimpleTitle(message: string): string {
    // Simple title generation - take first 50 characters
    const title = message.substring(0, 50).trim();
    return title.length < message.length ? title + '...' : title;
  }

  /**
   * Get conversation history for context
   */
  static async getConversationContext(
    conversationId: string, 
    maxMessages: number = 10
  ): Promise<Message[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return [];

    // Return the last N messages for context
    return conversation.messages.slice(-maxMessages);
  }

  /**
   * Clean up empty conversations (only welcome messages)
   */
  static async cleanupEmptyConversations(userId: string): Promise<void> {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const conversationsToDelete: string[] = [];

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const messages = data.messages || [];
      
      // If conversation only has 1 message and it's from assistant (welcome message)
      if (messages.length === 1 && messages[0].role === 'assistant') {
        conversationsToDelete.push(doc.id);
      }
    });

    // Delete empty conversations
    for (const conversationId of conversationsToDelete) {
      await this.deleteConversation(conversationId);
    }
  }
}
