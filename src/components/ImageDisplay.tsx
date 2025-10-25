'use client';

import { useState } from 'react';
import { Download, ExternalLink, Copy, Check, Languages } from 'lucide-react';

interface ImageDisplayProps {
  imageUrl: string;
  description?: string;
  style?: string;
  revisedPrompt?: string;
  onTranslate?: (url: string, description: string, labels?: string[]) => void;
}

export default function ImageDisplay({ 
  imageUrl, 
  description, 
  style, 
  revisedPrompt,
  onTranslate
}: ImageDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical-illustration-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying URL:', error);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(imageUrl, '_blank');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Image Container */}
      <div className="relative bg-gray-50">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
        
        <img
          src={imageUrl}
          alt={description || 'Medical illustration'}
          className={`w-full h-auto transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      </div>

      {/* Image Info */}
      <div className="p-4 space-y-3">
        {description && (
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Description</h4>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        )}

        {style && (
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Style</h4>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {style}
            </span>
          </div>
        )}

        {revisedPrompt && (
          <div>
            <h4 className="font-medium text-gray-900 mb-1">AI-Generated Prompt</h4>
            <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
              {revisedPrompt}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
          
          <button
            onClick={handleOpenInNewTab}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Open</span>
          </button>
          
          {onTranslate && (
            <button
              onClick={() => onTranslate(imageUrl, description || '', [])}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              title="Translate this medical illustration"
            >
              <Languages className="h-4 w-4" />
              <span>Translate</span>
            </button>
          )}
          
          <button
            onClick={handleCopyUrl}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied!' : 'Copy URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
