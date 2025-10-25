'use client';

import { useState, useEffect } from 'react';
import { Languages, Volume2, VolumeX, RotateCcw, Download } from 'lucide-react';

interface MedicalIllustrationTranslatorProps {
  imageUrl: string;
  originalDescription: string;
  originalLabels?: string[];
  onClose: () => void;
}

export default function MedicalIllustrationTranslator({
  imageUrl,
  originalDescription,
  originalLabels = [],
  onClose
}: MedicalIllustrationTranslatorProps) {
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [translatedDescription, setTranslatedDescription] = useState('');
  const [translatedLabels, setTranslatedLabels] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    translateContent();
  }, [targetLanguage]);

  const translateContent = async () => {
    setIsTranslating(true);

    try {
      // TODO: Replace with actual translation service
      console.log('Translating content', { targetLanguage, originalDescription, originalLabels });

      // Mock translation
      setTranslatedDescription(`[${targetLanguage.toUpperCase()}] ${originalDescription}`);
      setTranslatedLabels(originalLabels.map(label => `[${targetLanguage.toUpperCase()}] ${label}`));

      // No audio URL for now
      setAudioUrl(null);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const playAudioDescription = () => {
    if (audioUrl && !isMuted) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const downloadTranslatedImage = () => {
    // Create a canvas with translated labels overlaid on the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Add translated labels (simplified - in real implementation, you'd position these properly)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, 50);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(translatedDescription, 10, 30);
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medical-illustration-${targetLanguage}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    };
    
    img.src = imageUrl;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Languages className="h-6 w-6" />
              <h2 className="text-xl font-bold">Medical Illustration Translation</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Language Selector */}
          <div className="mt-4 flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Translate to</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full p-2 rounded-lg text-gray-900"
                disabled={isTranslating}
              >
                <option value="es">🇪🇸 Spanish</option>
                <option value="zh">🇨🇳 Chinese (Mandarin)</option>
                <option value="ar">🇸🇦 Arabic</option>
                <option value="hi">🇮🇳 Hindi</option>
                <option value="fr">🇫🇷 French</option>
                <option value="pt">🇵🇹 Portuguese</option>
                <option value="de">🇩🇪 German</option>
                <option value="ja">🇯🇵 Japanese</option>
                <option value="ko">🇰🇷 Korean</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button
                onClick={playAudioDescription}
                disabled={!audioUrl || isMuted}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors disabled:opacity-50"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original Image */}
            <div>
              <h3 className="font-medium text-black mb-3">Original Illustration</h3>
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Medical illustration"
                  className="w-full h-auto rounded-lg border border-gray-200"
                />
                {originalLabels.length > 0 && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white p-2 rounded text-sm">
                    <div className="font-medium mb-1">Labels:</div>
                    {originalLabels.map((label, index) => (
                      <div key={index}>• {label}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-black mb-1">Description:</div>
                <p className="text-sm text-black">{originalDescription}</p>
              </div>
            </div>

            {/* Translated Image */}
            <div>
              <h3 className="font-medium text-black mb-3">
                Translated to {targetLanguage.toUpperCase()}
                {isTranslating && (
                  <span className="ml-2 text-blue-600 text-sm">
                    <div className="inline-flex items-center space-x-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      <span>Translating...</span>
                    </div>
                  </span>
                )}
              </h3>

              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Medical illustration"
                  className="w-full h-auto rounded-lg border border-gray-200"
                />
                {translatedLabels.length > 0 && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white p-2 rounded text-sm">
                    <div className="font-medium mb-1">Labels:</div>
                    {translatedLabels.map((label, index) => (
                      <div key={index}>• {label}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="font-medium text-black mb-1">Description:</div>
                <p className="text-sm text-black">{translatedDescription}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={translateContent}
                disabled={isTranslating}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retranslate</span>
              </button>
              
              <button
                onClick={downloadTranslatedImage}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Translated Image</span>
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              Medical terminology optimized for {targetLanguage}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
