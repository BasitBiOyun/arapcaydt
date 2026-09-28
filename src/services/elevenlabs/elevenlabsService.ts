import { authHeaders } from '../supabase';
import { ElevenLabsVoice, ElevenLabsStatus, NarrationWord } from '../../types';
import { IElevenLabsService } from './types';
import { STANDARD_VOICE_CONFIG } from '../../config/voice';

class ElevenLabsService implements IElevenLabsService {
  private static instance: ElevenLabsService;

  private constructor() {}

  public static getInstance(): ElevenLabsService {
    if (!ElevenLabsService.instance) {
      ElevenLabsService.instance = new ElevenLabsService();
    }
    return ElevenLabsService.instance;
  }

  public async checkStatus(): Promise<ElevenLabsStatus> {
    try {
      const res = await fetch('/api/elevenlabs/status', { cache: 'no-store', headers: await authHeaders() });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      console.warn('Failed to fetch ElevenLabs status:', error);
      return {
        configured: false,
        mode: 'live',
        message: 'Ses servisi durumu sorgulanamadı.',
      };
    }
  }

  public async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const res = await fetch('/api/elevenlabs/voices', {headers: await authHeaders()});
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.voices || [];
    } catch (error) {
      console.warn('Failed to load voices from server, using platform default:', error);
      return [
        {
          voice_id: STANDARD_VOICE_CONFIG.voiceId,
          name: STANDARD_VOICE_CONFIG.name,
          language: 'Turkish & Arabic (Multilingual v2)',
          accent: 'Academic / Clear',
          gender: 'female',
          description: STANDARD_VOICE_CONFIG.description,
          recommended: true,
        },
      ];
    }
  }
}

export const elevenlabsService = ElevenLabsService.getInstance();
