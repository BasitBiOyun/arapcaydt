import { authHeaders } from '../supabase';
import { elevenlabsService } from '../elevenlabs/elevenlabsService';
import type { GenerateNarrationRequest, GenerateNarrationResponse } from '../elevenlabs/types';

const ELEVENLABS_FALLBACK_GAP_MS = 11_000;
let lastElevenLabsFallbackAt = -Infinity;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class NoFallbackError extends Error {}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(binary);
}

async function elevenLabsFallback(req: GenerateNarrationRequest, reason?: string): Promise<GenerateNarrationResponse> {
  const wait = lastElevenLabsFallbackAt + ELEVENLABS_FALLBACK_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastElevenLabsFallbackAt = Date.now();
  try {
    return await elevenlabsService.generateNarration(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ElevenLabs yedeği başarısız.';
    throw new Error(reason ? `${reason} ElevenLabs yedeği de başarısız: ${message}` : message);
  }
}

class NarrationService {
  private static instance: NarrationService;
  public static getInstance() {
    return this.instance || (this.instance = new NarrationService());
  }

  async generateNarration(req: GenerateNarrationRequest): Promise<GenerateNarrationResponse> {
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ projectId: req.projectId, text: req.text }),
      });

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer();
        if (!audioBuffer.byteLength) throw new Error('Gemini ses verisi boş döndü.');
        const duration = Number(res.headers.get('x-audio-duration') || 0);
        return {
          audioBase64: bufferToBase64(audioBuffer),
          mimeType: (res.headers.get('content-type') || 'audio/wav').split(';')[0],
          mode: 'live',
          durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 15,
          provider: 'gemini',
          modelId: res.headers.get('x-tts-model') || 'gemini-tts',
          voiceId: res.headers.get('x-tts-voice') || 'Achernar',
          voiceName: res.headers.get('x-tts-voice') || 'Achernar',
        };
      }

      const err = await res.json().catch(() => null);
      if (err?.fallbackAllowed === false) {
        throw new NoFallbackError(err?.error || `Gemini ses servisi hata döndürdü (HTTP ${res.status}).`);
      }
      return await elevenLabsFallback(req, err?.error || 'Gemini TTS kullanılamadı.');
    } catch (error) {
      if (error instanceof NoFallbackError) throw error;
      if (error instanceof Error && error.message.includes('ElevenLabs yedeği')) throw error;
      const reason = error instanceof Error ? `Gemini TTS bağlantısı başarısız: ${error.message}.` : 'Gemini TTS bağlantısı başarısız.';
      return await elevenLabsFallback(req, reason);
    }
  }
}

export const narrationService = NarrationService.getInstance();
