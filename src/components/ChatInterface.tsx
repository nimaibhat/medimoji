'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Brain, AlertCircle, ExternalLink, Languages, Bone, Volume2 } from 'lucide-react';

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
      x: number;
      y: number;
      intensity: number;
      type: string;
      size: number;
      timestamp: Date;
      bodyView: string;
    }>;
    bodyView: string;
    timestamp: Date;
    analysis: {
      possibleConditions: string[];
      severity: string;
      recommendations: string[];
    };
  };
}

interface ChatInterfaceProps {
  selectedAgent: string;
}

const predefinedPrompts = [
  "Send an email to rsmith@gmail.com about the appointment tomorrow at 2 PM",
  "Draw a medical illustration on how to wash your hands",
  "Create a surgical procedure illustration for appendectomy",
  "What are the latest treatment guidelines for hypertension?",
  "Generate a patient-friendly diagram explaining diabetes",
  "Draw your pain on the body diagram"
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

  const handlePainReport = (painReport: any) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: `I've drawn my pain on the body diagram. Here's my pain report:`,
      role: 'user',
      timestamp: new Date(),
      agent: selectedAgent,
      painReport: painReport
    };

    setMessages(prev => [...prev, userMessage]);

    // Generate AI response based on pain report
    const analysis = painReport.analysis;
    const bodyParts = Array.from(new Set(painReport.painPoints.map((point: any) => point.bodyPart).filter(Boolean)));
    const responseContent = `Based on your pain drawing, I can see:

**Pain Analysis:**
- Severity: ${analysis.severity.charAt(0).toUpperCase() + analysis.severity.slice(1)}
- Pain Points: ${painReport.painPoints.length} marked on ${painReport.bodyView} view
- Body Parts Affected: ${bodyParts.join(', ')}

**Possible Conditions:**
${analysis.possibleConditions.map((condition: string) => `• ${condition}`).join('\n')}

**Recommendations:**
${analysis.recommendations.map((rec: string) => `• ${rec}`).join('\n')}

This visual pain assessment will help your healthcare provider better understand your symptoms. The pattern recognition suggests ${analysis.possibleConditions[0] || 'localized pain'} which is important information for diagnosis.`;

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
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MediMoji</h1>
              <p className="text-gray-600 text-sm">AI-powered medical assistant for healthcare professionals</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ☑ Curie
            </span>
          </div>
        </div>
        
        {/* Agent Tag */}
        <div className="mb-6">
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gray-800 text-white">
            {selectedAgent === 'assistant' ? 'General Assistant' : selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1)}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {messages.length === 0 || !messages.some(msg => msg.role === 'user') ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">MediMoji</h2>
            <p className="text-gray-600 mb-6 max-w-md">An AI-powered medical assistant designed to streamline clinical workflows and enhance patient care</p>
            
            {/* Category Tag */}
            <div className="mb-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gray-800 text-white">
                Medical
              </span>
            </div>
            
            {/* Suggested Prompts */}
            <div className="w-full max-w-2xl space-y-3">
              {predefinedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full text-left p-4 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors shadow-sm hover:shadow-md"
                >
                  <p className="text-gray-700 text-sm">{prompt}</p>
                </button>
              ))}
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
                    {message.painReport && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-3">
                          <Bone className="h-5 w-5 text-red-500" />
                          <h4 className="font-medium text-red-900">Pain Report</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Pain Points:</span> {message.painReport.painPoints.length} marked on {message.painReport.bodyView} view
                            {message.painReport.painPoints.length > 0 && (
                              <div className="mt-2">
                                <span className="font-medium text-gray-700">Body Parts:</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {Array.from(new Set(message.painReport.painPoints.map((point: any) => point.bodyPart).filter(Boolean))).map((bodyPart: string, index: number) => (
                                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                      {bodyPart}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Severity:</span> 
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                              message.painReport.analysis.severity === 'mild' ? 'bg-green-100 text-green-800' :
                              message.painReport.analysis.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {message.painReport.analysis.severity.charAt(0).toUpperCase() + message.painReport.analysis.severity.slice(1)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Possible Conditions:</span>
                            <ul className="mt-1 ml-4 list-disc">
                              {message.painReport.analysis.possibleConditions.map((condition, index) => (
                                <li key={index} className="text-gray-600">{condition}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
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

      {/* Input Area */}
      <div className="px-6 py-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-sm"
                disabled={isLoading}
              />
              <div className="flex items-center space-x-2 ml-2">
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPainDrawingTool(true)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="Draw Your Pain"
                >
                  <Bone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowVoiceDubbing(true)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                  title="Voice Translation - Doctor-Patient Communication"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSpeechToText}
                  disabled={!speechSupported || isLoading}
                  className={`p-1.5 transition-colors ${
                    isListening 
                      ? 'text-red-500 hover:text-red-600' 
                      : speechSupported 
                        ? 'text-gray-400 hover:text-gray-600' 
                        : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={speechSupported ? (isListening ? 'Stop listening' : 'Start voice input') : 'Speech recognition not supported'}
                >
                  <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            </div>
            
            {/* Agent Suggestions */}
            {agentSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                {agentSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                  >
                    <span className="text-blue-600 text-sm">@{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        
        <p className="mt-3 text-xs text-gray-500 text-center">
          Curie AI is in beta. Please avoid sharing sensitive information.
        </p>
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
                <h2 className="text-2xl font-bold text-gray-900">Voice Translation</h2>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setVoiceDubbingTab('session')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      voiceDubbingTab === 'session'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    New Session
                  </button>
                  <button
                    onClick={() => setVoiceDubbingTab('history')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      voiceDubbingTab === 'history'
                        ? 'bg-white text-blue-600 shadow-sm'
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
