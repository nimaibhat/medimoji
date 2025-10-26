'use client';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/firebase';

export class AudioStorageService {
  /**
   * Upload audio blob to Firebase Storage and return persistent URL
   */
  static async uploadAudioBlob(
    audioBlob: Blob, 
    conversationId: string, 
    exchangeId: string, 
    type: 'original' | 'translated',
    language: string
  ): Promise<string> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const filename = `${conversationId}/${exchangeId}/${type}-${language}-${timestamp}.mp3`;
      
      // Create storage reference
      const audioRef = ref(storage, `voice-translations/${filename}`);
      
      // Upload the blob
      const snapshot = await uploadBytes(audioRef, audioBlob, {
        contentType: 'audio/mpeg'
      });
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log(`Audio uploaded successfully: ${filename}`);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading audio:', error);
      throw new Error('Failed to upload audio to storage');
    }
  }

  /**
   * Convert blob URL to actual blob for upload
   */
  static async blobUrlToBlob(blobUrl: string): Promise<Blob> {
    try {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Error converting blob URL to blob:', error);
      throw new Error('Failed to convert blob URL to blob');
    }
  }

  /**
   * Upload both original and translated audio for an exchange
   */
  static async uploadExchangeAudio(
    conversationId: string,
    exchangeId: string,
    originalBlobUrl: string,
    translatedBlobUrl: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<{ originalUrl: string; translatedUrl: string }> {
    try {
      // Convert blob URLs to actual blobs
      const [originalBlob, translatedBlob] = await Promise.all([
        this.blobUrlToBlob(originalBlobUrl),
        this.blobUrlToBlob(translatedBlobUrl)
      ]);

      // Upload both audio files
      const [originalUrl, translatedUrl] = await Promise.all([
        this.uploadAudioBlob(originalBlob, conversationId, exchangeId, 'original', sourceLanguage),
        this.uploadAudioBlob(translatedBlob, conversationId, exchangeId, 'translated', targetLanguage)
      ]);

      return { originalUrl, translatedUrl };
    } catch (error) {
      console.error('Error uploading exchange audio:', error);
      throw new Error('Failed to upload exchange audio');
    }
  }

  /**
   * Check if audio URL is a blob URL (temporary)
   */
  static isBlobUrl(url: string): boolean {
    return url.startsWith('blob:');
  }

  /**
   * Get audio URL with fallback for missing files
   */
  static async getAudioUrl(url: string): Promise<string | null> {
    try {
      // If it's already a persistent URL, return it
      if (!this.isBlobUrl(url)) {
        return url;
      }

      // Try to fetch the blob URL
      const response = await fetch(url);
      if (response.ok) {
        return url;
      }
      
      console.warn(`Audio URL not accessible: ${url}`);
      return null;
    } catch (error) {
      console.warn(`Error accessing audio URL: ${url}`, error);
      return null;
    }
  }
}
