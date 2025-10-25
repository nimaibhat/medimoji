'use client';

import { useEffect, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
import { X, Phone, PhoneOff, Mic } from 'lucide-react';

interface VapiTranslationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VapiTranslationPopup({ isOpen, onClose }: VapiTranslationPopupProps) {
  const vapiRef = useRef<Vapi | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Ready to start');
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Initialize Vapi client
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    console.log('VAPI Public Key:', publicKey ? 'Set' : 'Not set');

    if (!publicKey) {
      setStatus('Error: Vapi public key not set');
      return;
    }

    let vapi: Vapi;
    try {
      vapi = new Vapi(publicKey);
      vapiRef.current = vapi;
      console.log('VAPI client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize VAPI client:', error);
      setStatus('Error: Failed to initialize VAPI client');
      return;
    }

    // Set up event listeners
    vapi.on('call-start', () => {
      setIsCallActive(true);
      setIsLoading(false);
      setStatus('Call started - Translator active');
    });

    vapi.on('call-end', () => {
      setIsCallActive(false);
      setIsLoading(false);
      setStatus('Call ended');
    });

    vapi.on('speech-start', () => {
      setStatus('Listening...');
    });

    vapi.on('speech-end', () => {
      setStatus('Processing...');
    });

    vapi.on('message', (message: { type?: string; transcriptType?: string; transcript?: string }) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        setTranscript(prev => prev + '\n' + (message.transcript || ''));
      }
    });

    vapi.on('error', (error: { message?: string }) => {
      console.error('Vapi error:', error);
      setStatus(`Error: ${error.message || 'Unknown error'}`);
      setIsLoading(false);
      setIsCallActive(false);
    });

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, [isOpen]);

  const startCall = async () => {
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!assistantId) {
      setStatus('Error: Assistant ID not set');
      return;
    }

    if (!vapiRef.current) {
      setStatus('Error: Vapi not initialized');
      return;
    }

    setIsLoading(true);
    setStatus('Starting call...');
    setTranscript('');

    try {
      console.log('Starting VAPI call with assistant ID:', assistantId);
      await vapiRef.current.start(assistantId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start call:', error);
      setStatus(`Failed to start: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const endCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      setStatus('Ending call...');
    }
  };

  const handleClose = () => {
    if (isCallActive) {
      endCall();
    }
    setTranscript('');
    setStatus('Ready to start');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Voice Translation</h2>
          <p className="text-sm text-gray-600">
            Click start to begin real-time translation
          </p>
        </div>


        {/* Status Display */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-center">
          <div className="flex items-center justify-center mb-2">
            {isCallActive && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <Mic className="h-5 w-5 text-green-600" />
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-gray-500 mb-1">Status</div>
          <div className={`text-sm font-medium ${isCallActive ? 'text-green-600' : 'text-black'}`}>
            {status}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-3 mb-6">
          <button
            onClick={startCall}
            disabled={isCallActive || isLoading}
            className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Phone className="h-5 w-5" />
            <span>{isLoading ? 'Starting...' : 'Start Call'}</span>
          </button>

          <button
            onClick={endCall}
            disabled={!isCallActive}
            className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <PhoneOff className="h-5 w-5" />
            <span>End Call</span>
          </button>
        </div>

        {/* Transcript Display */}
        {transcript && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-black mb-2">Transcript</h3>
            <div className="text-sm text-black whitespace-pre-wrap leading-relaxed">
              {transcript}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
