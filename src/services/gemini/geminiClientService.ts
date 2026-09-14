import { AnnotationRegion, VideoAction, AudioNarration, NarrationSource, NarrationWord } from '../../types';

export interface GeminiStatusResponse {
  configured: boolean;
  model: string;
  message: string;
}

export interface AutoPipelineResult {
  success: boolean;
  regions: AnnotationRegion[];
  actions: VideoAction[];
  stats: {
    totalEventsPlanned: number;
    actionsGenerated: number;
    actionsSkipped: number;
    groundedOptions: string[];
  };
  deducedCorrectAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
  normalizedWords?: NarrationWord[];
}

/**
 * If the image is an SVG data URL (e.g. from sample question templates),
 * rasterizes it to a PNG data URL using an offscreen canvas so that
 * Gemini vision receives standard raster pixels.
 */
export async function rasterizeImageIfNeeded(imageUrl: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('data:image/svg')) {
    return imageUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 900;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(imageUrl);
      }
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}

class GeminiClientService {
  private static instance: GeminiClientService;

  public static getInstance(): GeminiClientService {
    if (!GeminiClientService.instance) {
      GeminiClientService.instance = new GeminiClientService();
    }
    return GeminiClientService.instance;
  }

  public async checkStatus(): Promise<GeminiStatusResponse> {
    try {
      const res = await fetch('/api/gemini/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        configured: false,
        model: 'gemini-3.8-flash',
        message: 'Gemini durumu kontrol edilemedi.',
      };
    }
  }

  public async transcribeAudio(
    audioBase64: string,
    mimeType = 'audio/mp3',
    solutionText = '',
    duration = 15
  ): Promise<{ transcript: string; duration: number; words: NarrationWord[] }> {
    const res = await fetch('/api/gemini/transcribe-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType, solutionText, duration }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Ses deşifre edilemedi' }));
      throw new Error(err.error || 'Ses deşifre edilemedi');
    }
    return await res.json();
  }

  public async runAutoPipeline(params: {
    imageUrl: string;
    solutionText: string;
    arabicQuestionSnippet?: string;
    correctAnswer?: string;
    audioNarration?: AudioNarration;
    narrationSource?: NarrationSource;
    onRetryStatus?: (attempt: number, maxAttempts: number, message: string) => void;
  }): Promise<AutoPipelineResult> {
    const rasterImageUrl = await rasterizeImageIfNeeded(params.imageUrl);

    const maxClientAttempts = 3;

    for (let attempt = 1; attempt <= maxClientAttempts; attempt++) {
      try {
        const res = await fetch('/api/gemini/auto-pipeline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: rasterImageUrl,
            solutionText: params.solutionText,
            arabicQuestionSnippet: params.arabicQuestionSnippet,
            correctAnswer: params.correctAnswer,
            audioNarration: params.audioNarration,
            narrationSource: params.narrationSource,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Video analizi şu anda tamamlanamadı.' }));
          const isTransient = res.status === 503 || res.status === 429 || res.status === 502 || res.status === 504 || errData.isTransient;

          if (isTransient && attempt < maxClientAttempts) {
            const delayMs = attempt * 1500 + Math.floor(Math.random() * 500);
            if (params.onRetryStatus) {
              params.onRetryStatus(
                attempt + 1,
                maxClientAttempts,
                `Gemini şu anda yoğun. Otomatik olarak yeniden deneniyor... (${attempt + 1}/${maxClientAttempts} deneme)`
              );
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }

          throw new Error(errData.error || 'Video analizi şu anda tamamlanamadı. Birkaç dakika sonra tekrar deneyebilirsiniz.');
        }

        return await res.json();
      } catch (err: any) {
        if (attempt === maxClientAttempts) {
          throw new Error('Video analizi şu anda tamamlanamadı. Birkaç dakika sonra tekrar deneyebilirsiniz.');
        }
        // Small delay and retry
        const delayMs = attempt * 1500 + Math.floor(Math.random() * 500);
        if (params.onRetryStatus) {
          params.onRetryStatus(
            attempt + 1,
            maxClientAttempts,
            `Gemini şu anda yoğun. Otomatik olarak yeniden deneniyor... (${attempt + 1}/${maxClientAttempts} deneme)`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Video analizi şu anda tamamlanamadı. Birkaç dakika sonra tekrar deneyebilirsiniz.');
  }
}

export const geminiService = GeminiClientService.getInstance();
