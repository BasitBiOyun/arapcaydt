import { authHeaders } from '../supabase';

/** The teacher's own Google AI Studio key as the server reports it (the key itself never reaches the browser). */
export interface TeacherKeyStatus {
  storageReady: boolean;
  key: { last4: string; status: 'active' | 'invalid'; updatedAt: string } | null;
  today: {
    tracking: boolean;
    /** limit: Google's free daily allowance for the teacher's own key (3 models × 10 voices, 25 timings). */
    tts: { used: number; limit?: number; exhaustedModels: number; models: number };
    transcribe: { used: number; limit?: number; exhausted: boolean };
    /** Shared (studio) key: the teacher's timings with their cap (null for admins), and voices used by everyone today. */
    shared: { used: number; limit: number | null; exhausted: boolean; ttsUsedAll?: number; ttsLimit?: number; ttsExhausted?: boolean };
    elevenlabs: { used: number; limit: number | null };
  };
}

async function call(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<TeacherKeyStatus> {
  const res = await fetch('/api/gemini/key', {
    method,
    cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...await authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Anahtar servisi hata döndürdü (HTTP ${res.status}).`);
  return data;
}

export const geminiKeyService = {
  status: () => call('GET'),
  save: (apiKey: string) => call('POST', { apiKey }),
  remove: () => call('DELETE'),
};

/** One plain sentence for the audio step: which capacity the next narration will use and how much is left today. */
export function capacityLine(status: TeacherKeyStatus | null): string | null {
  if (!status) return null;
  const { key, today } = status;
  const of = (used: number, limit?: number) => limit ? `${used} / ${limit}` : `${used}`;
  const pool = today.shared.ttsExhausted
    ? 'Ortak kapasitenin bugünkü ses hakkı doldu.'
    : today.shared.ttsLimit ? `Ortak kapasitede bugün herkes için toplam ${of(today.shared.ttsUsedAll ?? 0, today.shared.ttsLimit)} ses kullanıldı.` : '';
  if (!key) return `Ortak kapasite kullanılacak. ${pool} Kendi Google anahtarınızı Ayarlar’dan eklerseniz günde ${today.tts.limit ?? 30} ses ve ${today.transcribe.limit ?? 25} kelime zamanı yalnız sizin olur.`.replace(/\s+/g, ' ');
  if (key.status === 'invalid') return `Google anahtarınız geçersiz görünüyor; ortak kapasite kullanılıyor. Ayarlar’dan yenileyin. ${pool}`.trim();
  if (today.tts.exhaustedModels >= today.tts.models) return `Bugünkü seslendirme hakkınız doldu (${of(today.tts.used, today.tts.limit)}), ortak kapasite kullanılıyor. ${pool}`.trim();
  const usage = `Bugün: ${of(today.tts.used, today.tts.limit)} ses · ${of(today.transcribe.used, today.transcribe.limit)} kelime zamanı.`;
  if (today.transcribe.exhausted) return `Kendi Google anahtarınızla seslendirilecek. ${usage} Zamanlama hakkınız doldu; ortak kapasite kullanılıyor.`;
  return `Kendi Google anahtarınızla seslendirilecek. ${usage}`;
}
