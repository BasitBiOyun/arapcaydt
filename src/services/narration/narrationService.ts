import { authHeaders } from '../supabase';
import { quotaResetClock } from './geminiKeyService';
import type { GenerateNarrationRequest, GenerateNarrationResponse } from '../elevenlabs/types';
import { splitNarration } from './narrationParts';
import { decodeAudio, encodeMp3 } from './audioCodec';

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

/**
 * Only the best voice model was tried and it could not voice today ("daily") or right now ("busy").
 * The weaker backups add or drop sentences, flip negations and mispronounce Turkish, so the
 * teacher decides whether they may be used.
 */
export class TopModelUnavailableError extends VoiceUnavailableError {
  constructor(public reason: 'daily' | 'busy', detail: string) {
    super(detail, reason === 'daily'
      ? `Seslendirme yapılmadı. En üst düzey modelin kullanım hakkı her gün saat ${quotaResetClock()}’da yenilenir.`
      : 'Seslendirme yapılmadı. En üst düzey model biraz sonra yine denenebilir.');
  }
}

/** Asked once per narration before a backup model is used; true lets the backups voice. */
export type AskLowerModel = (reason: 'daily' | 'busy') => Promise<boolean>;

export const LOWER_MODEL_NOTE = 'Bu ses yedek modelle üretildi. Dinleyin: araya katılmış ya da yanlış okunmuş bir cümle varsa yalnız o cümleyi Ses şeridinden “Sesi düzelt” ile yeniden seslendirin.';

/** The teacher's question before a backup model voices (asked with the studio's confirm dialog). */
export function askLowerWith(confirm: (options: { title: string; message: string; confirmLabel: string; cancelLabel: string }) => Promise<boolean>): AskLowerModel {
  return reason => confirm({
    title: reason === 'daily' ? 'En üst düzey modelin bugünkü kullanım hakkı bitti' : 'En üst düzey model şu anda yanıt vermiyor',
    message: `Yedek modelle seslendirilebilir, ama yedek model araya olmayan cümleler katabilir, olumsuz cümleyi olumlu okuyabilir ya da Türkçeyi yanlış telaffuz edebilir; sesi mutlaka dinleyin. ${reason === 'daily'
      ? `En üst düzey modelin hakkı her gün saat ${quotaResetClock()}’da yenilenir.`
      : 'Birkaç dakika sonra en üst düzey modelle yeniden deneyebilirsiniz.'}`,
    confirmLabel: 'Yedek modelle seslendir',
    cancelLabel: reason === 'daily' ? 'Yarını bekleyeceğim' : 'Sonra deneyeceğim',
  });
}

/** What the teacher is told when /api/gemini/generate refuses. */
export function voiceFailure(status: number, err: any): VoiceUnavailableError {
  if (err?.code === 'TOP_MODEL_UNAVAILABLE') return new TopModelUnavailableError(err.reason === 'busy' ? 'busy' : 'daily', err?.error || 'En üst düzey model kullanılamadı.');
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

  /**
   * The voice for a solution. A long solution is voiced in parts (each its own request, which
   * finishes in time and skips less) and the parts are joined on the server into one narration.
   */
  async generateNarration(req: GenerateNarrationRequest, onPart?: (done: number, total: number) => void, askLower?: AskLowerModel): Promise<GenerateNarrationResponse> {
    // Once the teacher agreed to a backup model, the remaining parts may use it too.
    let allowLower = false;
    const voice = async (text: string) => {
      try {
        return await this.generatePart({ ...req, text }, allowLower);
      } catch (error) {
        if (!(error instanceof TopModelUnavailableError) || !askLower || !await askLower(error.reason)) throw error;
        allowLower = true;
        return this.generatePart({ ...req, text }, true);
      }
    };
    const parts = splitNarration(req.text);
    if (parts.length <= 1) return voice(req.text);
    const made: GenerateNarrationResponse[] = [];
    for (const [i, text] of parts.entries()) {
      onPart?.(i, parts.length);
      try {
        made.push(await voice(text));
      } catch (error) {
        if (error instanceof VoiceUnavailableError && !(error instanceof TopModelUnavailableError))
          throw new VoiceUnavailableError(`Bölüm ${i + 1}/${parts.length}: ${error.detail}`, `Uzun çözümün ${i + 1}. bölümü (toplam ${parts.length}) seslendirilemedi. ${error.message}`);
        throw error;
      }
    }
    onPart?.(parts.length, parts.length);
    // A part the server could not store came back in the answer itself: join in the browser.
    if (made.some(p => !p.assetPath)) {
      const samples = await Promise.all(made.map(p => decodeAudio(p.audioUrl!)));
      const whole = new Float32Array(samples.reduce((n, s) => n + s.length, 0));
      let at = 0;
      for (const s of samples) { whole.set(s, at); at += s.length; }
      return {
        ...made[0], audioUrl: URL.createObjectURL(await encodeMp3(whole)), assetPath: undefined, audioBase64: undefined,
        mimeType: 'audio/mpeg', durationSeconds: made.reduce((sum, p) => sum + p.durationSeconds, 0), lowerModel: made.some(p => p.lowerModel),
      };
    }
    let res: Response;
    try {
      res = await fetch('/api/gemini/join-parts', {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ projectId: req.projectId, text: req.text, parts: made.map(p => p.assetPath) }),
      });
    } catch (error) {
      throw new VoiceUnavailableError(timedOut(error) ? 'Ses bölümleri zamanında birleştirilemedi.' : 'Ses bölümleri birleştirilemedi.', VOICE_RETRY_MESSAGE);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.audioUrl || !data?.assetPath) throw new VoiceUnavailableError(data?.error || `HTTP ${res.status}`, data?.error || VOICE_RETRY_MESSAGE);
    return {
      ...made[0],
      audioUrl: data.audioUrl,
      assetPath: data.assetPath,
      mimeType: data.mimeType || made[0].mimeType,
      durationSeconds: made.reduce((sum, p) => sum + p.durationSeconds, 0),
      lowerModel: made.some(p => p.lowerModel),
    };
  }

  private async generatePart(req: GenerateNarrationRequest, allowLower = false): Promise<GenerateNarrationResponse> {
    let res: Response;
    try {
      res = await fetch('/api/gemini/generate', {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ projectId: req.projectId, text: req.text, canAsk: true, ...(allowLower ? { allowLower: true } : {}) }),
      });
    } catch (error) {
      throw new VoiceUnavailableError(timedOut(error)
        ? 'Seslendirme servisi zamanında yanıt vermedi. İnternet bağlantınızı kontrol edip birkaç dakika sonra tekrar deneyin.'
        : `Gemini TTS bağlantısı başarısız: ${error instanceof Error ? error.message : 'ağ hatası'}`);
    }
    if (res.ok) {
      const data = await res.json().catch(() => null);
      // A voice the server could not store arrives in the answer; the project stores it when saved.
      const audioUrl = data?.audioUrl || (data?.audioBase64 ? `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}` : '');
      if (!audioUrl) throw new VoiceUnavailableError('Gemini ses servisi ses dosyası döndürmedi.');
      return {
        audioUrl,
        assetPath: data.assetPath || undefined,
        mimeType: data.mimeType || 'audio/wav',
        mode: 'live',
        durationSeconds: Number(data.durationSeconds) > 0 ? Number(data.durationSeconds) : 15,
        provider: 'gemini',
        modelId: data.modelId || 'gemini-tts',
        voiceId: data.voiceId || 'Achernar',
        voiceName: data.voiceName || 'Achernar',
        lowerModel: data.lowerModel === true,
      };
    }
    const failure = voiceFailure(res.status, await res.json().catch(() => null));
    console.warn('[Seslendirme]', failure.detail);
    throw failure;
  }
}

export const narrationService = NarrationService.getInstance();
