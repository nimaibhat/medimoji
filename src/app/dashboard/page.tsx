'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import ChatInterface from '@/components/ChatInterface';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'gmail_connected') {
      setNotification({
        type: 'success',
        message: 'Gmail successfully connected! You can now use email features.'
      });
    } else if (error) {
      let errorMessage = 'An error occurred.';
      switch (error) {
        case 'gmail_auth_failed':
          errorMessage = 'Gmail authorization failed. Please try again.';
          break;
        case 'missing_parameters':
          errorMessage = 'Missing required parameters. Please try again.';
          break;
        case 'gmail_auth_error':
          errorMessage = 'Gmail authentication error. Please try again.';
          break;
      }
      setNotification({
        type: 'error',
        message: errorMessage
      });
    }

    // Clear notification after 5 seconds
    if (success || error) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <AppLayout>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg ${
          notification.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`ml-2 ${
                notification.type === 'success' ? 'text-green-400 hover:text-green-600' : 'text-red-400 hover:text-red-600'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <ChatInterface selectedAgent="assistant" />
    </AppLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}