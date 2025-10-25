'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink, AlertCircle, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface OpenAISettingsProps {
  onSuccess?: () => void;
}

export default function OpenAISettings({ onSuccess }: OpenAISettingsProps) {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [currentKey, setCurrentKey] = useState('');

  useEffect(() => {
    if (user) {
      loadCurrentSettings();
    }
  }, [user]);

  const loadCurrentSettings = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.openaiApiKey) {
          setCurrentKey(userData.openaiApiKey);
          setApiKey(userData.openaiApiKey);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const validateApiKey = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/test-openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: key,
          message: 'Test connection'
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !apiKey.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Validate the API key
      const isValid = await validateApiKey(apiKey.trim());
      
      if (!isValid) {
        setError('Invalid API key. Please check your key and try again.');
        setLoading(false);
        return;
      }

      // Store the API key in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        openaiApiKey: apiKey.trim(),
        openaiConnected: true,
        connectedAt: new Date(),
      }, { merge: true });

      setCurrentKey(apiKey.trim());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Error saving API key:', error);
      setError('Failed to save API key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetKey = () => {
    window.open('https://platform.openai.com/api-keys', '_blank');
  };

  const handleDisconnect = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        openaiApiKey: null,
        openaiConnected: false,
      }, { merge: true });
      
      setCurrentKey('');
      setApiKey('');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div>
            <h3 className="font-medium text-green-900">API Key Saved!</h3>
            <p className="text-sm text-green-700">
              Your OpenAI API key has been successfully configured.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentKey) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Key className="h-5 w-5 text-gray-500" />
            <div>
              <h3 className="font-medium text-gray-900">OpenAI Connected</h3>
              <p className="text-sm text-gray-600">
                API key configured ending in ...{currentKey.slice(-4)}
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Key className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-gray-900">OpenAI API Key</h3>
            <p className="text-sm text-gray-600">
              Configure your OpenAI API key to use AI features
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleGetKey}
              className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Get API Key</span>
            </button>

            <button
              type="submit"
              disabled={!apiKey.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
