'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Brain, AlertCircle, ExternalLink } from 'lucide-react';
import CustomIcon from './CustomIcon';

// Speech Recognition types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
import { processMessageWithLayeredAgent } from '@/lib/layered-message-processor';
import { parseCommand, getAgentSuggestions } from '@/lib/commandParser';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation } from '@/contexts/ConversationContext';
import { ConversationManager } from '@/lib/conversation-manager';
import { storeImagesPermanently } from '@/lib/image-storage';
import ImageDisplay from './ImageDisplay';
import MarkdownRenderer from './MarkdownRenderer';
import VoiceTranslationWidget from './VoiceTranslationWidget';
import MedicalIllustrationTranslator from './MedicalIllustrationTranslator';
import PainDrawingTool from './PainDrawingTool';
import PatientVoiceDubbingComponent from './PatientVoiceDubbingComponent';
import PastConversationsTab from './PastConversationsTab';

interface Message {
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
  painReport?: {
    painPoints: Array<{
      id: string;
      position: [number, number, number];
      intensity: number;
      type: string;
      size: number;
      timestamp: Date;
      bodyView: 'front' | 'back';
      bodyPart?: string;
    }>;
    bodyView: 'front' | 'back';
    timestamp: Date;
    analysis: {
      content: string;
    };
  };
}

interface ChatInterfaceProps {
  selectedAgent: string;
}

const medicalSuggestions = [
  {
    icon: "schedule-email",
    title: "Schedule Email",
    description: "Send appointment reminders",
    prompt: "Send an email to rsmith@gmail.com about the appointment tomorrow at 2 PM"
  },
  {
    icon: "medical-illustration",
    title: "Medical Illustration",
    description: "Create visual guides",
    prompt: "Draw a medical illustration on how to wash your hands"
  },
  {
    icon: "surgical-procedure",
    title: "Surgical Procedure",
    description: "Document procedures",
    prompt: "Create a surgical procedure illustration for appendectomy"
  },
  {
    icon: "treatment-guidelines",
    title: "Treatment Guidelines",
    description: "Latest protocols",
    prompt: "What are the latest treatment guidelines for hypertension?"
  },
  {
    icon: "patient-education",
    title: "Patient Education",
    description: "Visual explanations",
    prompt: "Generate a patient-friendly diagram explaining diabetes"
  },
  {
    icon: "medical-records",
    title: "Medical Records",
    description: "Patient documentation",
    prompt: "Generate a comprehensive medical record summary for patient consultation"
  }
];

export default function ChatInterface({ selectedAgent }: ChatInterfaceProps) {
  const { user } = useAuth();
  const { currentConversationId, setCurrentConversationId } = useConversation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentSuggestions, setAgentSuggestions] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastAgent, setLastAgent] = useState<string | null>(null);
  const isCreatingConversationRef = useRef(false);
  const [showTranslationWidget, setShowTranslationWidget] = useState(false);
  const [showIllustrationTranslator, setShowIllustrationTranslator] = useState(false);
  const [showPainDrawingTool, setShowPainDrawingTool] = useState(false);
  const [showVoiceDubbing, setShowVoiceDubbing] = useState(false);
  const [voiceDubbingTab, setVoiceDubbingTab] = useState<'session' | 'history'>('session');
  const [selectedImageForTranslation, setSelectedImageForTranslation] = useState<{
    url: string;
    description: string;
    labels?: string[];
  } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
          setIsListening(true);
        };
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
          setIsListening(false);
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Main conversation management effect
  useEffect(() => {

    if (!user) return;

    // If we have a specific conversation ID to load, load it
    if (currentConversationId && currentConversationId !== 'new') {
      loadConversation(currentConversationId);
      return;
    }

    // If we need a new conversation and haven't created one yet
    if ((!currentConversationId || currentConversationId === 'new') && !isInitialized && !isCreatingConversationRef.current) {
      // Initialize with welcome message but don't save to Firestore
      const welcomeMessage: Message = {
        id: '1',
        content: `Hello! I'm your ${selectedAgent} AI assistant. How can I help you today?`,
        role: 'assistant',
        timestamp: new Date(),
        agent: selectedAgent
      };
      
      setMessages([welcomeMessage]);
      setIsInitialized(true);
      return;
    }

    // If agent changed and we have an existing conversation, create new one
    if (isInitialized && selectedAgent && lastAgent && selectedAgent !== lastAgent && !isCreatingConversationRef.current) {
      const welcomeMessage: Message = {
        id: '1',
        content: `Hello! I'm your ${selectedAgent} AI assistant. How can I help you today?`,
        role: 'assistant',
        timestamp: new Date(),
        agent: selectedAgent
      };
      
      setMessages([welcomeMessage]);
      setCurrentConversationId(null); // Reset conversation ID
    }

    setLastAgent(selectedAgent);
  }, [user, currentConversationId, isInitialized, selectedAgent, lastAgent]);

  // Handle new conversation button click
  useEffect(() => {
    if (currentConversationId === 'new' && user && isInitialized) {
      // Reset the conversation state and show welcome message
      const welcomeMessage: Message = {
        id: '1',
        content: `Hello! I'm your ${selectedAgent} AI assistant. How can I help you today?`,
        role: 'assistant',
        timestamp: new Date(),
        agent: selectedAgent
      };
      
      setMessages([welcomeMessage]);
      setCurrentConversationId(null); // Reset to null so it doesn't keep triggering
    }
  }, [currentConversationId, user, isInitialized, selectedAgent]);

  const loadConversation = async (conversationId: string) => {
    try {
      const conversation = await ConversationManager.getConversation(conversationId);
      if (conversation) {
        setCurrentConversationId(conversationId);
        setMessages(conversation.messages);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };


  const createNewConversation = async () => {
    
    if (!user || isCreatingConversationRef.current) {
      return;
    }
    
    isCreatingConversationRef.current = true;
    
    try {
      // Clean up any empty conversations first
      await ConversationManager.cleanupEmptyConversations(user.uid);
      
      // Add welcome message directly to the conversation creation
      const welcomeMessage: Message = {
        id: '1',
        content: `Hello! I'm your ${selectedAgent} AI assistant. How can I help you today?`,
        role: 'assistant',
        timestamp: new Date(),
        agent: selectedAgent
      };
      
      // Create conversation with welcome message included
      const conversationId = await ConversationManager.createConversationWithMessage(
        user.uid, 
        selectedAgent, 
        welcomeMessage
      );
      
      
      setCurrentConversationId(conversationId);
      
      setMessages([welcomeMessage]);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error creating new conversation:', error);
      setIsInitialized(true);
    } finally {
      isCreatingConversationRef.current = false;
    }
  };

  const createConversationWithFirstMessage = async (userMessage: Message, messageContent: string) => {
    if (!user || isCreatingConversationRef.current) return;
    
    isCreatingConversationRef.current = true;
    
    try {
      // Clean up any empty conversations first
      await ConversationManager.cleanupEmptyConversations(user.uid);
      
      // Create conversation with the user's first message
      const conversationId = await ConversationManager.createConversationWithMessage(
        user.uid, 
        selectedAgent, 
        userMessage
      );
      
      
      setCurrentConversationId(conversationId);
      setMessages([userMessage]);
      
      // Process the message with the AI
      setInputValue('');
      setIsLoading(true);
      
      try {
        if (!user) {
          throw new Error('User not authenticated');
        }
        
        // Use the new layered message processor
        const response = await processMessageWithLayeredAgent(messageContent, user.uid, selectedAgent);
        
        // Check if authorization is required
        const needsAuth = response.needsAuthorization || false;
        const authorizationUrl = response.authorizationUrl;
        
        // Determine the actual agent used (from classification or override)
        const actualAgent = response.classification?.agent || selectedAgent;
        
        // Extract image information from tool calls
        let imageUrl, imageDescription, imageStyle, revisedPrompt;
        if (response.toolCalls && response.toolCalls.length > 0) {
          const imageToolCall = response.toolCalls.find(tc => 
            tc.function?.name === 'generate_medical_illustration'
          );
          if (imageToolCall) {
            try {
              const args = JSON.parse(imageToolCall.function.arguments);
              imageUrl = args.imageUrl;
              imageDescription = args.description;
              imageStyle = args.style;
              revisedPrompt = args.revisedPrompt;
            } catch (error) {
              console.error('Error parsing image tool call arguments:', error);
            }
          }
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: needsAuth ? 'Authorization required' : response.content,
          role: 'assistant',
          timestamp: new Date(),
          agent: actualAgent,
          needsAuthorization: needsAuth,
          ...(authorizationUrl && { authorizationUrl }),
          ...(response.toolName && { toolName: response.toolName }),
          ...(imageUrl && { imageUrl }),
          ...(imageDescription && { imageDescription }),
          ...(imageStyle && { imageStyle }),
          ...(revisedPrompt && { revisedPrompt })
        };
        
        // Store images permanently if they exist
        let finalMessage = assistantMessage;
        if (imageUrl) {
          const storedImageData = await storeImagesPermanently(
            { imageUrl, imageDescription, imageStyle, revisedPrompt },
            conversationId,
            assistantMessage.id
          );
          finalMessage = { ...assistantMessage, ...storedImageData };
        }
        
        // Add assistant message to conversation
        setMessages(prev => [...prev, finalMessage]);
        await ConversationManager.addMessage(conversationId, finalMessage);
      } catch (error) {
        console.error('Error processing message:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          role: 'assistant',
          timestamp: new Date(),
          agent: selectedAgent
        };
        
        // Add error message to conversation
        setMessages(prev => [...prev, errorMessage]);
        await ConversationManager.addMessage(conversationId, errorMessage);
      } finally {
        setIsLoading(false);
      }
      
    } catch (error) {
      console.error('Error creating conversation with first message:', error);
    } finally {
      isCreatingConversationRef.current = false;
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Check if user wants to draw pain
    if (content.toLowerCase().includes('draw') && content.toLowerCase().includes('pain')) {
      setShowPainDrawingTool(true);
      return;
    }

    // Parse command if it starts with @
    const command = parseCommand(content);
    const agentToUse = command ? command.agent : selectedAgent;
    const messageContent = command ? command.content : content;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
      agent: agentToUse
    };

    // If no conversation exists in Firestore yet, create one with the user's first message
    if (!currentConversationId) {
      await createConversationWithFirstMessage(userMessage, messageContent);
      return;
    }

    // Add user message to existing conversation
    setMessages(prev => [...prev, userMessage]);
    await ConversationManager.addMessage(currentConversationId, userMessage);

    // Generate title if this is the first user message
    if (messages.length === 1 && messages[0].role === 'assistant') {
      // This is the first user message, generate a title
      ConversationManager.generateAndUpdateTitle(currentConversationId, content);
    }
    
    setInputValue('');
    setIsLoading(true);

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Use the new layered message processor
      const response = await processMessageWithLayeredAgent(messageContent, user.uid, agentToUse);
      
      // Check if authorization is required
      const needsAuth = response.needsAuthorization || false;
      const authorizationUrl = response.authorizationUrl;
      
      // Determine the actual agent used (from classification or override)
      const actualAgent = response.classification?.agent || agentToUse;
      
      // Extract image information from tool calls
      let imageUrl, imageDescription, imageStyle, revisedPrompt;
      if (response.toolCalls && response.toolCalls.length > 0) {
        const imageToolCall = response.toolCalls.find(tc => 
          tc.function?.name === 'generate_medical_illustration'
        );
        if (imageToolCall) {
          try {
            const args = JSON.parse(imageToolCall.function.arguments);
            imageUrl = args.imageUrl;
            imageDescription = args.description;
            imageStyle = args.style;
            revisedPrompt = args.revisedPrompt;
          } catch (error) {
            console.error('Error parsing image tool call arguments:', error);
          }
        }
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: needsAuth ? 'Authorization required' : response.content,
        role: 'assistant',
        timestamp: new Date(),
        agent: actualAgent,
        needsAuthorization: needsAuth,
        ...(authorizationUrl && { authorizationUrl }),
        ...(response.toolName && { toolName: response.toolName }),
        ...(imageUrl && { imageUrl }),
        ...(imageDescription && { imageDescription }),
        ...(imageStyle && { imageStyle }),
        ...(revisedPrompt && { revisedPrompt })
      };
      
      // Store images permanently if they exist
      let finalMessage = assistantMessage;
      if (imageUrl) {
        const storedImageData = await storeImagesPermanently(
          { imageUrl, imageDescription, imageStyle, revisedPrompt },
          currentConversationId,
          assistantMessage.id
        );
        finalMessage = { ...assistantMessage, ...storedImageData };
      }
      
      // Add assistant message to conversation
      setMessages(prev => [...prev, finalMessage]);
      await ConversationManager.addMessage(currentConversationId, finalMessage);
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        agent: agentToUse
      };
      
      // Add error message to conversation
      setMessages(prev => [...prev, errorMessage]);
      await ConversationManager.addMessage(currentConversationId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Update agent suggestions based on input
    const suggestions = getAgentSuggestions(value);
    setAgentSuggestions(suggestions);
  };

  const handleSpeechToText = () => {
    if (!speechSupported || !recognitionRef.current) {
      console.error('Speech recognition not supported');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        handleSendMessage(inputValue);
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const currentInput = inputValue.split(' ')[0];
    const newInput = `@${suggestion} ` + inputValue.substring(currentInput.length + 1);
    setInputValue(newInput);
    setAgentSuggestions([]);
  };

  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleImageTranslation = (imageUrl: string, description: string, labels?: string[]) => {
    setSelectedImageForTranslation({ url: imageUrl, description, labels });
    setShowIllustrationTranslator(true);
  };

  const handlePainReport = (painReport: {
    painPoints: Array<{
      id: string;
      position: [number, number, number];
      intensity: number;
      type: string;
      size: number;
      timestamp: Date;
      bodyView: 'front' | 'back';
      bodyPart?: string;
    }>;
    bodyView: 'front' | 'back';
    timestamp: Date;
    analysis: {
      content: string;
    };
  }) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: `I've drawn my pain on the body diagram. Here's my pain report:`,
      role: 'user',
      timestamp: new Date(),
      agent: selectedAgent,
      painReport: painReport
    };

    setMessages(prev => [...prev, userMessage]);

    // Use the actual LLM analysis content directly
    const analysis = painReport.analysis;
    const bodyParts = Array.from(new Set(painReport.painPoints.map(point => point.bodyView).filter(Boolean)));
    
    // Debug: Log the analysis object to see what we're working with
    console.log('=== CHAT INTERFACE ANALYSIS DEBUG ===');
    console.log('Analysis object:', JSON.stringify(analysis, null, 2));
    console.log('Analysis content:', analysis.content);
    console.log('=== END ANALYSIS DEBUG ===\n');
    
    // Use the AI-generated structured content directly
    const responseContent = `## AI Pain Analysis Report

### Summary
- **Pain Points**: ${painReport.painPoints.length} marked on ${painReport.bodyView} view
- **Body Parts Affected**: ${bodyParts.length > 0 ? bodyParts.join(', ') : 'Multiple areas'}

---

${analysis.content || 'Analysis content not available'}

---

*This AI analysis is for informational purposes only and should not replace professional medical evaluation.*`;

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: responseContent,
      role: 'assistant',
      timestamp: new Date(),
      agent: selectedAgent
    };

    setMessages(prev => [...prev, assistantMessage]);
  };

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'email': return 'bg-green-100 text-green-800';
      case 'illustration': return 'bg-purple-100 text-purple-800';
      case 'assistant': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Professional Medical Header */}
      <div className="px-6 pt-6 pb-4 border-b border-blue-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#113B5C' }}>
              <img 
                src="/Medimoji_Logo-removebg-preview.png" 
                alt="MediMoji Logo" 
                className="h-16 w-16 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#113B5C' }}>MediMoji</h1>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#76C5E0' }}>Clinical Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border" style={{ backgroundColor: '#F8FBFC', borderColor: '#76C5E0' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#76C5E0' }}></div>
              <span className="text-xs font-medium" style={{ color: '#113B5C' }}>Curie</span>
          </div>
        </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {messages.length === 0 || !messages.some(msg => msg.role === 'user') ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            {/* Refined Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm overflow-hidden bg-white border-2" style={{ borderColor: '#113B5C' }}>
                <img 
                  src="/Medimoji_Logo-removebg-preview.png" 
                  alt="MediMoji Logo" 
                  className="h-20 w-20 object-contain"
                />
            </div>
              <h2 className="text-xl font-semibold mb-2 tracking-tight" style={{ color: '#113B5C' }}>Curie</h2>
              <p className="text-sm leading-relaxed" style={{ color: '#76C5E0' }}>Streamline your workflow with intelligent medical assistance. Select a task below or type your request.</p>
            </div>
            
            {/* Compact Medical Suggestion Cards */}
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {medicalSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(suggestion.prompt)}
                  className="group text-left p-4 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-all duration-200 shadow-sm hover:shadow-md hover:border-slate-300"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <CustomIcon 
                        name={suggestion.icon as 'schedule-email' | 'medical-illustration' | 'surgical-procedure' | 'treatment-guidelines' | 'patient-education' | 'medical-records'} 
                        size="sm" 
                        className="text-slate-600 group-hover:text-slate-800 transition-colors duration-200" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1 tracking-tight">{suggestion.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{suggestion.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Compact Footer Hint */}
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500 font-medium">Start by selecting a suggestion above or typing your medical query below</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-3xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'assistant' && message.agent && (
                    <div className="mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAgentColor(message.agent)}`}>
                        @{message.agent}
                      </span>
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                {message.needsAuthorization ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="h-5 w-5 text-blue-500" />
                      <div>
                        <h3 className="font-medium text-blue-900">Authorization Required</h3>
                        <p className="text-sm text-blue-700 mb-3">
                          To use {message.toolName || 'this feature'}, you need to authorize access in your settings.
                        </p>
                        <a
                          href="/settings"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>Go to Settings</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <MarkdownRenderer 
                      content={message.content} 
                      theme={message.role === 'user' ? 'dark' : 'light'}
                    />
                    {message.imageUrl && (
                      <div className="mt-4">
                        <ImageDisplay
                          imageUrl={message.imageUrl}
                          description={message.imageDescription}
                          style={message.imageStyle}
                          revisedPrompt={message.revisedPrompt}
                          onTranslate={(url, desc, labels) => handleImageTranslation(url, desc, labels)}
                        />
                      </div>
                    )}
                  </div>
                )}
                    <p className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">Curie is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Professional Medical Input Area */}
      <div className="px-6 py-4 bg-white border-t border-slate-200">
        {/* Medical Tools Section */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#76C5E0' }}>Medical Tools</span>
            <div className="h-px flex-1 max-w-20" style={{ backgroundColor: '#76C5E0' }}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-center space-x-6 mb-4">
          {/* Voice Translation Tool */}
          <button
            type="button"
            onClick={() => setShowVoiceDubbing(true)}
            className="group flex flex-col items-center space-y-2 p-4 rounded-xl transition-all duration-200 border border-transparent hover:border-blue-200"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F0F9FF';
              const iconBg = e.currentTarget.querySelector('.icon-bg') as HTMLElement;
              if (iconBg) iconBg.style.backgroundColor = '#113B5C';
              const icon = e.currentTarget.querySelector('.tool-icon') as HTMLElement;
              if (icon) icon.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              const iconBg = e.currentTarget.querySelector('.icon-bg') as HTMLElement;
              if (iconBg) iconBg.style.backgroundColor = '#113B5C';
              const icon = e.currentTarget.querySelector('.tool-icon') as HTMLElement;
              if (icon) icon.style.color = '#76C5E0';
            }}
            title="Voice Translation - Doctor-Patient Communication"
          >
            <div className="icon-bg w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm" style={{ backgroundColor: '#113B5C' }}>
              <CustomIcon name="voice-translation" size="md" className="tool-icon text-[#76C5E0]" />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#113B5C' }}>Voice Translation</span>
          </button>

          {/* Pain Assessment Tool */}
          <button
            type="button"
            onClick={() => setShowPainDrawingTool(true)}
            className="group flex flex-col items-center space-y-2 p-4 rounded-xl transition-all duration-200 border border-transparent hover:border-blue-200"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F0F9FF';
              const iconBg = e.currentTarget.querySelector('.icon-bg') as HTMLElement;
              if (iconBg) iconBg.style.backgroundColor = '#113B5C';
              const icon = e.currentTarget.querySelector('.tool-icon') as HTMLElement;
              if (icon) icon.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              const iconBg = e.currentTarget.querySelector('.icon-bg') as HTMLElement;
              if (iconBg) iconBg.style.backgroundColor = '#113B5C';
              const icon = e.currentTarget.querySelector('.tool-icon') as HTMLElement;
              if (icon) icon.style.color = '#76C5E0';
            }}
            title="Pain Assessment - Visual pain mapping"
          >
            <div className="icon-bg w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm" style={{ backgroundColor: '#113B5C' }}>
              <CustomIcon name="3d-body-model" size="md" className="tool-icon text-[#76C5E0]" />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#113B5C' }}>Pain Assessment</span>
          </button>
        </div>

        {/* Professional Medical Input Section */}
        <div className="relative">
          <form onSubmit={handleSubmit} className="relative">
            {/* Main Input Container */}
            <div className="relative bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              {/* Input Field */}
              <div className="flex items-center px-6 py-4">
          <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                    placeholder="Ask Curie about medical procedures, patient care, or clinical guidelines..."
                    className="w-full bg-transparent border-none outline-none text-base font-medium placeholder-slate-400 resize-none"
                    style={{ color: '#113B5C' }}
                disabled={isLoading}
              />
                  
                  {/* Character Count (if needed) */}
                  {inputValue.length > 0 && (
                    <div className="absolute -bottom-6 right-0 text-xs text-slate-400">
                      {inputValue.length} characters
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-1 ml-4">
                  {/* Attachment Button */}
                <button
                  type="button"
                    className="p-2.5 rounded-xl transition-all duration-200 hover:bg-slate-100 group"
                    title="Attach medical documents or images"
                >
                    <Paperclip className="h-5 w-5 text-slate-500 group-hover:text-slate-700" strokeWidth={1.5} />
                </button>
                  
                  {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={handleSpeechToText}
                  disabled={!speechSupported || isLoading}
                    className={`p-2.5 rounded-xl transition-all duration-200 ${
                    isListening 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                    } ${!speechSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={speechSupported ? (isListening ? 'Stop voice input' : 'Start voice input') : 'Speech recognition not supported'}
                  >
                    <Mic className={`h-5 w-5 ${isListening ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
                  </button>
                  
                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className={`p-3 rounded-xl transition-all duration-200 shadow-sm ${
                      inputValue.trim() && !isLoading
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            
              {/* Input Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Curie is online</span>
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    HIPAA compliant • Secure
                  </div>
                </div>
              </div>
            </div>
            
            {/* Agent Suggestions Dropdown */}
            {agentSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-3 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Suggested Agents</span>
                </div>
                {agentSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-200 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-slate-700 font-medium">@{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
        </form>
        </div>
        
      </div>

      {/* Voice Translation Widget */}
      {showTranslationWidget && (
        <VoiceTranslationWidget
          isOpen={showTranslationWidget}
          onClose={() => setShowTranslationWidget(false)}
          medicalContext="general"
        />
      )}


      {/* Medical Illustration Translator */}
      {showIllustrationTranslator && selectedImageForTranslation && (
        <MedicalIllustrationTranslator
          imageUrl={selectedImageForTranslation.url}
          originalDescription={selectedImageForTranslation.description}
          originalLabels={selectedImageForTranslation.labels}
          onClose={() => {
            setShowIllustrationTranslator(false);
            setSelectedImageForTranslation(null);
          }}
        />
      )}


      {/* Pain Drawing Tool */}
      <PainDrawingTool
        isOpen={showPainDrawingTool}
        onClose={() => setShowPainDrawingTool(false)}
        onSendPainReport={handlePainReport}
      />

      {/* Voice Dubbing Modal */}
      {showVoiceDubbing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-900">Voice Translation</h2>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setVoiceDubbingTab('session')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      voiceDubbingTab === 'session'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    New Session
                  </button>
                  <button
                    onClick={() => setVoiceDubbingTab('history')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      voiceDubbingTab === 'history'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Past Conversations
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVoiceDubbing(false);
                  setVoiceDubbingTab('session');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              {voiceDubbingTab === 'session' ? (
                <PatientVoiceDubbingComponent />
              ) : (
                <PastConversationsTab onBack={() => setVoiceDubbingTab('session')} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
