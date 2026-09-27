import { authHeaders } from '../supabase';

/** The teacher's own Google AI Studio key as the server reports it (the key itself never reaches the browser). */
export interface TeacherKeyStatus {
  storageReady: boolean;
  key: { last4: string; status: 'active' | 'invalid'; updatedAt: string } | null;
  today: {
    tracking: boolean;
    tts: { used: number; exhaustedModels: number; models: number };
    transcribe: { used: number; exhausted: boolean };
    /** limit is null for admins (not capped). */
    shared: { used: number; limit: number | null; exhausted: boolean };
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

/** One plain sentence for the audio step: which capacity the next narration will use. */
export function capacityLine(status: TeacherKeyStatus | null): string | null {
  if (!status) return null;
  const { key, today } = status;
  if (!key) return 'Ortak kapasite kullanılacak. Kendi Google anahtarınızı Ayarlar’dan ekleyebilirsiniz.';
  if (key.status === 'invalid') return 'Google anahtarınız geçersiz görünüyor; ortak kapasite kullanılıyor. Ayarlar’dan yenileyin.';
  if (today.tts.exhaustedModels >= today.tts.models) return 'Bugünkü seslendirme hakkınız doldu, ortak kapasite kullanılıyor.';
  if (today.transcribe.exhausted) return 'Kendi anahtarınızla seslendirilecek. Bugünkü zamanlama hakkınız doldu; ortak kapasite kullanılıyor.';
  return 'Kendi Google anahtarınızla seslendirilecek.';
}
