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
      const res = await fetch('/api/elevenlabs/status');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      console.warn('Failed to fetch ElevenLabs status:', error);
      return {
        configured: false,
        mode: 'live',
        message: 'ElevenLabs durumu sorgulanamadı.',
      };
    }
  }

  public async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const res = await fetch('/api/elevenlabs/voices');
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
      text: req.text,
      voiceId: req.voiceId || STANDARD_VOICE_CONFIG.voiceId,
      modelId: req.modelId || STANDARD_VOICE_CONFIG.modelId,
      outputFormat: req.outputFormat || STANDARD_VOICE_CONFIG.outputFormat,
      voiceSettings: req.voiceSettings || STANDARD_VOICE_CONFIG.voiceSettings,
    };

    const res = await fetch('/api/elevenlabs/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Sunucudan bilinmeyen hata yanıtı alındı.' }));
      throw new Error(err.error || `Sunucu hata kodu: ${res.status}`);
    }

    return await res.json();
  }
}

export const elevenlabsService = ElevenLabsService.getInstance();
