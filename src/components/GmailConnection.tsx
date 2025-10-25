'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink, AlertCircle, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface GmailCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}

interface GmailConnectionProps {
  showInSettings?: boolean;
}

export default function GmailConnection({ showInSettings = false }: GmailConnectionProps) {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<{
    gmailConnected: boolean;
    gmailCredentials?: GmailCredentials;
    gmailConnectedAt?: Date;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (user) {
      loadConnectionStatus();
    }
  }, [user]);

  // Periodic token validation to prevent unexpected disconnections
  useEffect(() => {
    if (!user || !connectionStatus?.gmailConnected) return;

    const interval = setInterval(() => {
      // Check if token will expire in the next 5 minutes
      if (connectionStatus.gmailCredentials && 
          connectionStatus.gmailCredentials.expires_at - Date.now() < 5 * 60 * 1000) {
        loadConnectionStatus();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user, connectionStatus]);

  const loadConnectionStatus = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        let credentials = userData.gmailCredentials;
        
        // Check if token is expired and refresh if needed
        if (credentials && Date.now() >= credentials.expires_at) {
          try {
            const refreshResponse = await fetch('/api/auth/gmail/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                refresh_token: credentials.refresh_token,
                user_id: user.uid
              })
            });

            if (refreshResponse.ok) {
              const newCredentials = await refreshResponse.json();
              credentials = newCredentials;
              
              // Update the credentials in Firestore
              await setDoc(userRef, {
                gmailCredentials: newCredentials,
              }, { merge: true });
            } else {
              const errorData = await refreshResponse.json();
              // Only mark as disconnected if it's a revocation error (401)
              if (refreshResponse.status === 401) {
                await setDoc(userRef, {
                  gmailConnected: false,
                  gmailCredentials: null,
                }, { merge: true });
                credentials = null;
              }
              // For other errors, keep the old credentials and let the user retry
            }
          } catch (refreshError) {
            console.error('Error refreshing Gmail token:', refreshError);
            // Refresh failed, mark as disconnected
            await setDoc(userRef, {
              gmailConnected: false,
              gmailCredentials: null,
            }, { merge: true });
            credentials = null;
          }
        }
        
        setConnectionStatus({
          gmailConnected: userData.gmailConnected && credentials !== null,
          gmailCredentials: credentials,
          gmailConnectedAt: userData.gmailConnectedAt?.toDate()
        });
      } else {
        setConnectionStatus(null);
      }
    } catch (error) {
      console.error('Error loading connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user) return;
    
    setConnecting(true);
    try {
      const response = await fetch(`/api/auth/gmail?userId=${user.uid}`);
      const { authUrl } = await response.json();
      
      if (authUrl) {
        // Store the return URL so we can redirect back after OAuth
        localStorage.setItem('gmail_oauth_return', window.location.pathname);
        window.location.href = authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        gmailCredentials: null,
        gmailConnected: false,
      }, { merge: true });
      
      setConnectionStatus(null);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (connectionStatus?.gmailConnected) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-medium text-gray-900">Gmail Connected</h3>
              <p className="text-sm text-gray-600">
                Connected on {connectionStatus.gmailConnectedAt?.toLocaleDateString()}
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
          <Mail className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-gray-900">Gmail Integration</h3>
            <p className="text-sm text-gray-600">
              Connect your Gmail account to send emails and manage communications
            </p>
          </div>
        </div>

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span>{connecting ? 'Connecting...' : 'Connect Gmail'}</span>
        </button>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">What we&apos;ll access:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Read and send emails</li>
                <li>• Compose and manage drafts</li>
                <li>• Organize your inbox</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
