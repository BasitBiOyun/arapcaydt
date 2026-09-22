import { authHeaders } from '../supabase';
import { ElevenLabsVoice, ElevenLabsStatus } from '../../types';
import { GenerateNarrationRequest, GenerateNarrationResponse, IElevenLabsService } from './types';
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

  public async generateNarration(req: GenerateNarrationRequest): Promise<GenerateNarrationResponse> {
    const payload: GenerateNarrationRequest = {
      projectId: req.projectId,
      text: req.text,
      voiceId: req.voiceId || STANDARD_VOICE_CONFIG.voiceId,
      modelId: req.modelId || STANDARD_VOICE_CONFIG.modelId,
      outputFormat: req.outputFormat || STANDARD_VOICE_CONFIG.outputFormat,
      voiceSettings: req.voiceSettings || STANDARD_VOICE_CONFIG.voiceSettings,
    };

    let res: Response;
    try {
      res = await fetch('/api/elevenlabs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...await authHeaders(),
        },
        body: JSON.stringify(payload),
      });
    } catch (error: any) {
      throw new Error(`Ses servisine ulaşılamadı: ${error?.message || 'Ağ bağlantısı başarısız.'}`);
    }

    if (!res.ok) {
      const contentType = res.headers.get('content-type') || '';
      let message = '';

      if (contentType.includes('application/json')) {
        const err = await res.json().catch(() => null);
        message = err?.error || err?.message || '';
      } else {
        const raw = await res.text().catch(() => '');
        if (raw && !raw.toLowerCase().includes('<!doctype html')) {
          message = raw.slice(0, 300);
        }
      }

      if (!message) {
        if (res.status === 404) {
          message = 'Ses API endpointi Vercel dağıtımında bulunamadı (HTTP 404).';
        } else if (res.status === 405) {
          message = 'Ses API endpointi yanlış HTTP yöntemiyle çağrıldı (HTTP 405).';
        } else if (res.status >= 500) {
          message = `Ses sunucusunda hata oluştu (HTTP ${res.status}).`;
        } else {
          message = `Ses servisi hata döndürdü (HTTP ${res.status}).`;
        }
      }

      throw new Error(message);
    }

    const result = await res.json();
    if (!result?.audioBase64) {
      throw new Error('Ses servisi yanıt verdi fakat ses verisi gelmedi.');
    }

    return result;
  }
}

export const elevenlabsService = ElevenLabsService.getInstance();
