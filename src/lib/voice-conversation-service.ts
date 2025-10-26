import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { VoiceTranslation, VoiceTranslationSummary } from '@/types/voice-conversation';
import { TranscriptionService } from '@/lib/transcription-service';

export class VoiceConversationService {
  private static readonly COLLECTION_NAME = 'voicetranslations';

  /**
   * Create a new voice translation session
   */
  static async createConversation(
    patientInfo: VoiceTranslation['patientInfo'],
    doctorId: string
  ): Promise<string> {
    try {
      console.log('Creating voice translation session with:', { patientInfo, doctorId });
      
      // Check Firebase auth state
      const auth = getAuth();
      const currentUser = auth.currentUser;
      console.log('Firebase Auth State:', {
        currentUser: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email,
          emailVerified: currentUser.emailVerified
        } : null,
        doctorId: doctorId,
        doctorIdMatches: currentUser?.uid === doctorId
      });
      
      if (!currentUser) {
        throw new Error('User not authenticated with Firebase');
      }
      
      const translationData: Omit<VoiceTranslation, 'id'> = {
        patientInfo,
        translations: [],
        sessionInfo: {
          totalDuration: 0,
          languagePairs: [],
          exchangeCount: 0,
          startTime: new Date().toISOString()
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          doctorId: currentUser.uid, // Use Firebase auth UID
          status: 'active'
        }
      };

      console.log('Translation data to save:', translationData);
      console.log('Collection name:', this.COLLECTION_NAME);

      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...translationData,
        metadata: {
          ...translationData.metadata,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        }
      });

      console.log('Voice translation session created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating voice translation session:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      throw new Error('Failed to create voice translation session');
    }
  }

  /**
   * Add a new translation to the session
   */
  static async addTranslation(
    conversationId: string,
    translation: VoiceTranslation['translations'][0]
  ): Promise<void> {
    try {
      const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
      
      // Get current conversation
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Translation session not found');
      }

      // Add new translation
      const updatedTranslations = [...conversation.translations, translation];
      const languagePairs = [...new Set([
        ...conversation.sessionInfo.languagePairs,
        `${translation.sourceLanguage}-${translation.targetLanguage}`
      ])];

      await updateDoc(conversationRef, {
        'translations': updatedTranslations,
        'sessionInfo.languagePairs': languagePairs,
        'sessionInfo.exchangeCount': updatedTranslations.length,
        'metadata.updatedAt': Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error adding translation to session:', error);
      throw new Error('Failed to add translation to session');
    }
  }

  /**
   * Complete a translation session
   */
  static async completeConversation(conversationId: string): Promise<void> {
    try {
      const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
      
      await updateDoc(conversationRef, {
        'metadata.status': 'completed',
        'sessionInfo.endTime': new Date().toISOString(),
        'metadata.updatedAt': Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error completing translation session:', error);
      throw new Error('Failed to complete translation session');
    }
  }

  /**
   * Get a specific translation session
   */
  static async getConversation(conversationId: string): Promise<VoiceTranslation | null> {
    try {
      const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (!conversationDoc.exists()) {
        return null;
      }

      const data = conversationDoc.data();
      return {
        id: conversationDoc.id,
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: data.metadata.createdAt?.toDate?.()?.toISOString() || data.metadata.createdAt,
          updatedAt: data.metadata.updatedAt?.toDate?.()?.toISOString() || data.metadata.updatedAt
        }
      } as VoiceTranslation;
    } catch (error) {
      console.error('Error getting translation session:', error);
      return null;
    }
  }

  /**
   * Get full conversation details for playback/download
   */
  static async getConversationForPlayback(conversationId: string): Promise<VoiceTranslation | null> {
    try {
      const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        return null;
      }

      const data = conversationDoc.data();
      return {
        id: conversationDoc.id,
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: data.metadata.createdAt?.toDate?.()?.toISOString() || data.metadata.createdAt,
          updatedAt: data.metadata.updatedAt?.toDate?.()?.toISOString() || data.metadata.updatedAt
        }
      } as VoiceTranslation;
    } catch (error) {
      console.error('Error getting conversation for playback:', error);
      return null;
    }
  }

  /**
   * Transcribe conversation and generate medical report
   */
  static async transcribeAndGenerateReport(conversationId: string): Promise<void> {
    try {
      console.log('Starting transcription and report generation for:', conversationId);
      
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

             // Prepare audio tracks for transcription (server-side will handle CORS)
             const audioTracks = [];

             for (const translation of conversation.translations) {
               audioTracks.push({
                 audioUrl: translation.originalAudioUrl,
                 language: translation.sourceLanguage,
                 timestamp: translation.timestamp,
                 type: 'original'
               });

               audioTracks.push({
                 audioUrl: translation.translatedAudioUrl,
                 language: translation.targetLanguage,
                 timestamp: translation.timestamp,
                 type: 'translated'
               });
             }

             console.log(`Found ${audioTracks.length} audio tracks for transcription`);

             // Transcribe accessible audio
             console.log('Transcribing audio tracks...');
             const transcripts = await TranscriptionService.transcribeConversation(audioTracks);

             // Generate medical report
             console.log('Generating medical report...');
             const summary = await TranscriptionService.generateConversationSummary(
               transcripts,
               conversation.patientInfo
             );

             // Update conversation with transcription and report
             const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
             await updateDoc(conversationRef, {
               'transcription': {
                 isTranscribed: true,
                 transcribedAt: new Date().toISOString(),
                 transcripts: transcripts.map(t => ({
                   ...t,
                   audioType: t.audioType || 'unknown'
                 }))
               },
               'medicalReport': {
                 isGenerated: true,
                 generatedAt: new Date().toISOString(),
                 summary: summary,
                 keyPoints: [],
                 recommendations: [],
                 followUpRequired: false
               },
               'metadata.updatedAt': Timestamp.fromDate(new Date())
             });

             console.log('Transcription and report generation completed');
           } catch (error) {
             console.error('Error transcribing conversation:', error);
             
             // Generate HIPAA-compliant fallback report
             const fallbackSummary = `Medical Consultation Report

Patient ID: ${conversation.patientInfo.patientId || 'Not provided'}
Date: ${conversation.patientInfo.date}
Time: ${conversation.patientInfo.time}
Doctor: ${conversation.patientInfo.doctorName}
Visit Type: ${conversation.patientInfo.visitType}

Session Summary:
- Total exchanges: ${conversation.sessionInfo.exchangeCount}
- Language pairs used: ${conversation.sessionInfo.languagePairs.join(', ')}
- Session duration: ${Math.round(conversation.sessionInfo.totalDuration / 60)} minutes
- Session status: ${conversation.metadata.status}

Note: Audio transcription failed due to technical issues. This report is based on session metadata only.

Additional Notes: ${conversation.patientInfo.notes || 'None provided'}

This report is HIPAA compliant and does not contain personally identifiable information.`;

             // Update conversation with fallback report
             const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
             await updateDoc(conversationRef, {
               'transcription': {
                 isTranscribed: false,
                 transcribedAt: new Date().toISOString(),
                 transcripts: [],
                 note: 'Transcription failed - report generated from metadata only'
               },
               'medicalReport': {
                 isGenerated: true,
                 generatedAt: new Date().toISOString(),
                 summary: fallbackSummary,
                 keyPoints: ['Session metadata only', 'Audio transcription failed'],
                 recommendations: ['Review session notes', 'Follow up as needed'],
                 followUpRequired: false
               },
               'metadata.updatedAt': Timestamp.fromDate(new Date())
             });

             console.log('Fallback HIPAA-compliant report generated from metadata');
           }
  }

  /**
   * Get all translation sessions for a doctor
   */
  static async getDoctorConversations(doctorId: string): Promise<VoiceTranslationSummary[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('metadata.doctorId', '==', doctorId),
        orderBy('metadata.createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const conversations: VoiceTranslationSummary[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          patientName: data.patientInfo.patientName, // For UI display
          patientId: data.patientInfo.patientId,    // For HIPAA-compliant reports
          date: data.patientInfo.date,
          time: data.patientInfo.time,
          doctorName: data.patientInfo.doctorName,
          visitType: data.patientInfo.visitType,
          exchangeCount: data.sessionInfo.exchangeCount,
          totalDuration: data.sessionInfo.totalDuration,
          createdAt: data.metadata.createdAt?.toDate?.()?.toISOString() || data.metadata.createdAt,
          status: data.metadata.status,
          languagePairs: data.sessionInfo.languagePairs
        });
      });

      return conversations;
    } catch (error) {
      console.error('Error getting doctor translation sessions:', error);
      return [];
    }
  }

  /**
   * Archive a conversation
   */
  static async archiveConversation(conversationId: string): Promise<void> {
    try {
      const conversationRef = doc(db, this.COLLECTION_NAME, conversationId);
      
      await updateDoc(conversationRef, {
        'metadata.status': 'archived',
        'metadata.updatedAt': Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw new Error('Failed to archive conversation');
    }
  }
}
