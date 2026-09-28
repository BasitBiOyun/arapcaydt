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

  /** Aligns the known solution text to an uploaded MP3 on the server. Throws on any failure. */
  public async alignUploadedNarration(req: { projectId: string; text: string; audioBase64: string; mimeType: string }): Promise<NarrationWord[]> {
    const res = await fetch('/api/elevenlabs/align', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify(req),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.words) || !data.words.length) throw new Error(data?.error || `Hizalama başarısız (HTTP ${res.status}).`);
    return data.words.map((w: NarrationWord) => ({ text: w.text, start: w.start, end: w.end }));
  }
}

export const elevenlabsService = ElevenLabsService.getInstance();
