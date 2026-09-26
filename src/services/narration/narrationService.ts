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
    const result = await elevenlabsService.generateNarration(req);
    return { ...result, provider: 'elevenlabs', message: reason || result.message };
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

  async alignGeneratedNarration(projectId: string): Promise<Array<{ text: string; start: number; end: number }>> {
    const res = await fetch('/api/gemini/align-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Gemini zamanlama servisi hata döndürdü (HTTP ${res.status}).`);
    return Array.isArray(data?.words) ? data.words : [];
  }

  async generateNarration(req: GenerateNarrationRequest): Promise<GenerateNarrationResponse> {
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ projectId: req.projectId, text: req.text }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data?.audioUrl || !data?.assetPath) throw new Error('Gemini ses servisi ses dosyası konumu döndürmedi.');
        return {
          audioUrl: data.audioUrl,
          assetPath: data.assetPath,
          mimeType: data.mimeType || 'audio/wav',
          mode: 'live',
          durationSeconds: Number(data.durationSeconds) > 0 ? Number(data.durationSeconds) : 15,
          provider: 'gemini',
          modelId: data.modelId || 'gemini-tts',
          voiceId: data.voiceId || 'Achernar',
          voiceName: data.voiceName || 'Achernar',
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
