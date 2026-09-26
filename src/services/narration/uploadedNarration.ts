import type { AudioNarration, NarrationSource, NarrationWord } from '../../types';

/** Mirrors the server limit in api/elevenlabs/align.ts (Vercel 4.5 MB body, base64 overhead). */
export const MAX_ALIGN_AUDIO_BYTES = 3 * 1024 * 1024;

export interface UploadedNarrationDeps {
  readDataUrl: (file: File) => Promise<string>;
  readDuration: (dataUrl: string) => Promise<number>;
  /** Server forced alignment of the known script; throws when unavailable. */
  align?: (audioBase64: string, mimeType: string) => Promise<NarrationWord[]>;
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
 * Word timings for a teacher's MP3: the solution text is aligned to the audio
 * first; local Whisper and finally untimed audio are fallbacks, so the
 * teacher is never blocked by a timing service.
 */
export async function prepareUploadedNarration(file: File, deps: UploadedNarrationDeps): Promise<UploadedNarrationResult> {
  const dataUrl = await deps.readDataUrl(file);
  const audioBase64 = dataUrl.split(',')[1] || '';
  const mimeType = file.type || 'audio/mpeg';
  let words: NarrationWord[] = [];
  let duration = 0;
  let timingSource: NarrationSource['timingSource'] = 'none';
  let notice: string | undefined;

  if (deps.align && file.size <= MAX_ALIGN_AUDIO_BYTES) {
    deps.onProgress?.(30, 'Çözüm metni sese hizalanıyor...');
    try {
      words = await deps.align(audioBase64, mimeType);
      duration = await deps.readDuration(dataUrl);
      timingSource = 'forced-alignment';
    } catch (error) {
      notice = `Metin–ses hizalaması yapılamadı (${error instanceof Error ? error.message : 'bilinmeyen hata'}); zamanlar yerel ses tanımayla tahmin edildi.`;
    }
  } else if (deps.align) {
    notice = 'Ses dosyası sunucu hizalaması için 3 MB sınırını aşıyor; zamanlar yerel ses tanımayla tahmin edildi.';
  }

  if (timingSource === 'none') {
    try {
      const transcription = await deps.transcribe(file);
      words = transcription.words;
      duration = transcription.duration;
      timingSource = 'whisper';
    } catch {
      duration = await deps.readDuration(dataUrl);
      notice = 'Sesten kelime zamanı çıkarılamadı. İşaretlerin zamanlamasını önizlemede kontrol edin.';
    }
  }
  duration = Math.round((duration || 15) * 100) / 100;

  const generatedAt = new Date().toISOString();
  const source: NarrationSource = {
    type: 'uploaded', audioUrl: dataUrl, audioBase64, duration, fileName: file.name,
    words, timingSource, isApproved: false, generatedAt,
  };
  const compat: AudioNarration = {
    audioUrl: dataUrl, audioBase64, duration, voiceId: timingSource === 'forced-alignment' ? 'forced-alignment' : 'local-whisper',
    voiceName: file.name, modelId: timingSource === 'forced-alignment' ? 'elevenlabs-forced-alignment' : 'whisper-tiny-local',
    generatedAt, isApproved: false, mode: 'live', words,
  };
  return { source, compat, notice };
}
