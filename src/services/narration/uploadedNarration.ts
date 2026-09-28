import type { AudioNarration, NarrationSource, NarrationWord } from '../../types';

type ServerTiming = NonNullable<NarrationSource['timingSource']>;

export interface UploadedNarrationDeps {
  readDataUrl: (file: File) => Promise<string>;
  readDuration: (dataUrl: string) => Promise<number>;
  /**
   * Server timings for the audio once it is stored with the project (Gemini
   * Transcribe, then ElevenLabs Forced Alignment of the written solution).
   * Receives the untimed narration to save first; throws when unavailable.
   */
  align?: (untimed: { source: NarrationSource; compat: AudioNarration }) => Promise<{ words: NarrationWord[]; timingSource: ServerTiming }>;
  /** Local speech recognition fallback. */
  transcribe: (file: File) => Promise<{ words: NarrationWord[]; duration: number }>;
  onProgress?: (progress: number, message: string) => void;
}

export interface UploadedNarrationResult {
  source: NarrationSource;
  compat: AudioNarration;
  /** Shown to the teacher when timing quality is lower than forced alignment. */
  notice?: string;
}

/**
 * Word timings for a teacher's MP3: the stored audio is timed on the server
 * first (no size limit in the browser); local Whisper and finally untimed
 * audio are fallbacks, so the teacher is never blocked by a timing service.
 */
export async function prepareUploadedNarration(file: File, deps: UploadedNarrationDeps): Promise<UploadedNarrationResult> {
  const dataUrl = await deps.readDataUrl(file);
  const audioBase64 = dataUrl.split(',')[1] || '';
  const mimeType = file.type || 'audio/mpeg';
  const generatedAt = new Date().toISOString();
  const build = (words: NarrationWord[], timingSource: NarrationSource['timingSource'], duration: number) => {
    const rounded = Math.round((duration || 15) * 100) / 100;
    const engine = timingSource === 'gemini-transcribe' ? 'gemini-transcribe' : timingSource === 'forced-alignment' ? 'elevenlabs-forced-alignment' : 'whisper-tiny-local';
    const source: NarrationSource = {
      type: 'uploaded', audioUrl: dataUrl, audioBase64, duration: rounded, fileName: file.name, mimeType,
      words, timingSource, isApproved: false, generatedAt,
    };
    const compat: AudioNarration = {
      audioUrl: dataUrl, audioBase64, duration: rounded, voiceId: engine, voiceName: file.name, modelId: engine,
      generatedAt, isApproved: false, mode: 'live', words,
    };
    return { source, compat };
  };

  const duration = await deps.readDuration(dataUrl);
  let notice: string | undefined;
  if (deps.align) {
    deps.onProgress?.(30, 'Ses kaydediliyor ve çözüm metnine hizalanıyor...');
    try {
      const timing = await deps.align(build([], 'none', duration));
      if (timing.words.length) return build(timing.words, timing.timingSource, duration);
      notice = 'Sunucu kelime zamanı döndürmedi; zamanlar yerel ses tanımayla tahmin edildi.';
    } catch (error) {
      console.warn('[MP3 zamanlama]', error);
      notice = 'Sunucuda kelime zamanı alınamadı; zamanlar bilgisayarınızda ses tanımayla tahmin edildi. İşaretleri önizlemede kontrol edin.';
    }
  }
  try {
    const transcription = await deps.transcribe(file);
    return { ...build(transcription.words, 'whisper', transcription.duration || duration), notice };
  } catch {
    return { ...build([], 'none', duration), notice: 'Sesten kelime zamanı çıkarılamadı. İşaretlerin zamanlamasını önizlemede kontrol edin.' };
  }
}
