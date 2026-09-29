import { authHeaders } from '../supabase';
import { quotaResetClock } from './geminiKeyService';
import type { GenerateNarrationRequest, GenerateNarrationResponse } from '../elevenlabs/types';

export const VOICE_QUOTA_MESSAGE = `Bugünkü ücretsiz ses hakkı doldu. Kendi Google anahtarınızı ekleyin (Ayarlar → Google anahtarım) ya da haklar yenilenince (her gün saat ${quotaResetClock()}) tekrar deneyin.`;
export const VOICE_RETRY_MESSAGE = 'Şu anda ses üretilemedi. Birkaç dakika sonra tekrar deneyin.';

/**
 * Gemini could not make the voice. Voice comes only from the three Gemini
 * models (ElevenLabs is used for word timings only). The teacher sees one plain
 * sentence; the technical chain stays in `detail` and the admin request log.
 */
export class VoiceUnavailableError extends Error {
  constructor(public detail: string, message = VOICE_RETRY_MESSAGE) {
    super(message);
  }
}

/** What the teacher is told when /api/gemini/generate refuses. */
export function voiceFailure(status: number, err: any): VoiceUnavailableError {
  const detail = err?.error || `Gemini ses servisi hata döndürdü (HTTP ${status}).`;
  // Input and permission problems are the teacher's to fix; say exactly what.
  if (err?.fallbackAllowed === false || status === 401) return new VoiceUnavailableError(detail, err?.error || VOICE_RETRY_MESSAGE);
  // "No model left today" includes every model having been skipped already for its daily quota.
  const exhausted = allDailyQuota(err?.attempts) || (err?.code === 'GEMINI_TTS_EXHAUSTED' && Array.isArray(err?.attempts) && !err.attempts.length);
  return new VoiceUnavailableError(detail, exhausted ? VOICE_QUOTA_MESSAGE : VOICE_RETRY_MESSAGE);
}

/** Every model on every key refused for today's quota (not a minute limit or a network error). */
export function allDailyQuota(attempts: unknown): boolean {
  return Array.isArray(attempts) && attempts.length > 0 && attempts.every(a => (a as { daily?: boolean })?.daily === true);
}

export interface GeneratedAlignmentResult {
  words: Array<{ text: string; start: number; end: number }>;
  timingSource: 'gemini-transcribe' | 'forced-alignment';
  loss?: number | null;
}

/** Voice and timing requests end on the server within 120 s; the browser never waits much longer. */
export const REQUEST_TIMEOUT_MS = 135_000;
const timedOut = (error: unknown) => error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');

async function requestAlignment(endpoint: string, projectId: string): Promise<{ ok: boolean; data: any; status: number }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data, status: res.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: timedOut(error) ? 'Zamanlama servisi zamanında yanıt vermedi.' : error instanceof Error ? error.message : 'Zamanlama servisine ulaşılamadı.' },
    };
  }
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
    let res: Response;
    try {
      res = await fetch('/api/gemini/generate', {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ projectId: req.projectId, text: req.text }),
      });
    } catch (error) {
      throw new VoiceUnavailableError(timedOut(error)
        ? 'Seslendirme servisi zamanında yanıt vermedi. İnternet bağlantınızı kontrol edip birkaç dakika sonra tekrar deneyin.'
        : `Gemini TTS bağlantısı başarısız: ${error instanceof Error ? error.message : 'ağ hatası'}`);
    }
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data?.audioUrl || !data?.assetPath) throw new VoiceUnavailableError('Gemini ses servisi ses dosyası konumu döndürmedi.');
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
    const failure = voiceFailure(res.status, await res.json().catch(() => null));
    console.warn('[Seslendirme]', failure.detail);
    throw failure;
  }
}

export const narrationService = NarrationService.getInstance();
