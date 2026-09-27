import { authHeaders } from '../supabase';
import { elevenlabsService } from '../elevenlabs/elevenlabsService';
import type { GenerateNarrationRequest, GenerateNarrationResponse } from '../elevenlabs/types';

const ELEVENLABS_FALLBACK_GAP_MS = 11_000;
let lastElevenLabsFallbackAt = -Infinity;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class NoFallbackError extends Error {}

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

export interface GeneratedAlignmentResult {
  words: Array<{ text: string; start: number; end: number }>;
  timingSource: 'gemini-transcribe' | 'forced-alignment';
  loss?: number | null;
}

async function requestAlignment(endpoint: string, projectId: string): Promise<{ ok: boolean; data: any; status: number }> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ projectId }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data, status: res.status };
}

class NarrationService {
  private static instance: NarrationService;

  public static getInstance() {
    return this.instance || (this.instance = new NarrationService());
  }

  async alignGeneratedNarration(projectId: string): Promise<GeneratedAlignmentResult> {
    const failures: string[] = [];

    const gemini = await requestAlignment('/api/gemini/align-project', projectId);
    if (gemini.ok && Array.isArray(gemini.data?.words) && gemini.data.words.length) {
      return {
        words: gemini.data.words,
        timingSource: 'gemini-transcribe',
        loss: typeof gemini.data?.loss === 'number' ? gemini.data.loss : null,
      };
    }
    failures.push(`Gemini Transcribe: ${gemini.data?.error || `HTTP ${gemini.status}`}`);

    const eleven = await requestAlignment('/api/elevenlabs/align-project', projectId);
    if (eleven.ok && Array.isArray(eleven.data?.words) && eleven.data.words.length) {
      return {
        words: eleven.data.words,
        timingSource: 'forced-alignment',
        loss: typeof eleven.data?.loss === 'number' ? eleven.data.loss : null,
      };
    }
    failures.push(`ElevenLabs Forced Alignment: ${eleven.data?.error || `HTTP ${eleven.status}`}`);

    throw new Error(failures.join(' · '));
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
      const reason = error instanceof Error
        ? `Gemini TTS bağlantısı başarısız: ${error.message}.`
        : 'Gemini TTS bağlantısı başarısız.';
      return await elevenLabsFallback(req, reason);
    }
  }
}

export const narrationService = NarrationService.getInstance();
