import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY environment variable is missing on server.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
}

export const PRIMARY_MODEL = 'gemini-3.8-flash';
export const FALLBACK_MODEL = 'gemini-flash-latest';

/**
 * Checks if an error is a transient retryable error: 429, 500, 502, 503, 504, UNAVAILABLE, high demand.
 * Explicitly rejects permanent request/configuration errors like 400, 401, 403.
 */
export function isTransientGeminiError(err: any): boolean {
  if (!err) return false;

  const status = err.status || err.code || err.statusCode || err.error?.code;

  // Never retry permanent client/auth errors
  if (status === 400 || status === 401 || status === 403) {
    return false;
  }

  const msg = (err.message || err.toString() || '').toLowerCase();
  const statusStr = (err.statusText || err.error?.status || '').toLowerCase();

  // Quota exhaustion check: DO NOT RETRY daily / resource exhaustion
  const isQuotaExhausted =
    statusStr.includes('resource_exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('generaterequestsperday') ||
    msg.includes('quota exceeded') ||
    msg.includes('daily quota') ||
    msg.includes('free tier limit');

  if (isQuotaExhausted) {
    return false;
  }

  // Transient HTTP status codes (503 server overloaded/unavailable, 500, 502, 504)
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  // 429 inspected: only transient if NOT quota exhausted
  if (status === 429) {
    return true;
  }

  // Keyword check for high-demand capacity spikes and unavailable errors
  return (
    statusStr.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('try again later') ||
    msg.includes('overloaded')
  );
}

/** Backwards-compatibility alias */
export const isRetryableGeminiError = isTransientGeminiError;

/**
 * Computes backoff delay with jitter according to the schedule:
 * attempt 1 -> immediate (0ms)
 * attempt 2 -> ~1.5 seconds
 * attempt 3 -> ~3.0 seconds
 * attempt 4 -> ~6.0 seconds
 * attempt 5 -> ~12.0 seconds
 */
export function getBackoffDelayMs(attempt: number): number {
  switch (attempt) {
    case 1:
      return 0;
    case 2:
      return 1500 + Math.floor(Math.random() * 300);
    case 3:
      return 3000 + Math.floor(Math.random() * 500);
    case 4:
      return 6000 + Math.floor(Math.random() * 1000);
    case 5:
    default:
      return 12000 + Math.floor(Math.random() * 1500);
  }
}

/**
 * Generates content with robust exponential backoff, jitter, and automatic fallback model switching.
 * Primary: PRIMARY_MODEL ('gemini-3.8-flash')
 * Fallback: FALLBACK_MODEL ('gemini-flash-latest')
 */
export async function generateContentWithRetry(params: {
  contents: any[];
  config?: any;
  model?: string;
  maxAttempts?: number;
  onRetry?: (attempt: number, maxAttempts: number, model: string, delayMs: number) => void;
}): Promise<any> {
  const ai = getGeminiClient();
  const modelsToTry = [
    params.model || PRIMARY_MODEL,
    ...(params.model && params.model !== FALLBACK_MODEL ? [FALLBACK_MODEL] : [FALLBACK_MODEL]),
  ];
  // Deduplicate models
  const uniqueModels = Array.from(new Set(modelsToTry));

  const maxAttempts = params.maxAttempts ?? 5;
  let lastError: any = null;

  for (const currentModel of uniqueModels) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const isTransient = isTransientGeminiError(err);

        if (!isTransient) {
          // Permanent error (e.g. invalid parameter), fail fast
          console.error(`[Gemini Error] Non-transient error encountered with model ${currentModel}:`, err?.message || err);
          throw err;
        }

        const isLastAttemptForModel = attempt === maxAttempts;
        if (!isLastAttemptForModel) {
          const delayMs = getBackoffDelayMs(attempt + 1);
          console.warn(
            `[Gemini Retry] Transient error (${err?.status || '503/high demand'}) on ${currentModel}. Attempt ${attempt}/${maxAttempts}. Backoff delay: ${delayMs}ms`
          );

          if (params.onRetry) {
            params.onRetry(attempt + 1, maxAttempts, currentModel, delayMs);
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        console.warn(`[Gemini Model Fallback] Retries exhausted for ${currentModel}. Attempting fallback model if available...`);
      }
    }
  }

  // If all retries and fallback models failed, wrap into a clean application error
  const sanitizedError: any = new Error(
    'Video analizi şu anda tamamlanamadı. Birkaç dakika sonra tekrar deneyebilirsiniz.'
  );
  sanitizedError.isTransient = true;
  sanitizedError.originalError = lastError;
  sanitizedError.statusCode = 503;
  throw sanitizedError;
}
