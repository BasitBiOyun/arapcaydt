import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Daily quota bookkeeping for the Google (Gemini) and ElevenLabs timing chain.
 *
 * Order per request:
 *   TTS:        teacher key (4 models) → studio key (4 models) → ElevenLabs TTS
 *   Timestamps: teacher Transcribe → studio Transcribe (per-teacher cap)
 *               → ElevenLabs Forced Alignment (per-teacher cap) → local Whisper
 *
 * The activity log is the single source of truth: every upstream request is
 * one row with its key source, so "used today" and "exhausted today" are read
 * back from it. Gemini free quotas reset at midnight Pacific time.
 */
export const SHARED_TRANSCRIBE_PER_TEACHER = 25;
export const ELEVENLABS_ALIGN_PER_TEACHER = 20;
export const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
] as const;
export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

export type KeySource = 'teacher' | 'system';

export function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  return key;
}

export const quotaDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(iso));

/** First instant of the current Pacific quota day, as an ISO string. */
export function pacificDayStart(nowIso = new Date().toISOString()): string {
  const day = quotaDay(nowIso);
  for (const offset of ['-07:00', '-08:00']) {
    const start = new Date(`${day}T00:00:00${offset}`);
    if (quotaDay(start.toISOString()) === day && quotaDay(new Date(start.getTime() - 1).toISOString()) !== day) return start.toISOString();
  }
  return new Date(`${day}T00:00:00-08:00`).toISOString();
}

/**
 * A 429 whose quota is per day (or a model with a free-tier limit of 0) stays
 * exhausted until the Pacific reset; per-minute 429s are retried next time.
 */
export function isDailyQuotaError(status: number, raw: string): boolean {
  return status === 429 && /PerDay|per[ _-]?day|limit:\s*0\b/i.test(raw || '');
}

/** Usage row detail: "model · status" plus " · daily" for a daily-quota 429. */
export function usageDetail(model: string, status: number | string, daily = false): string {
  return `${model} · ${status}${daily ? ' · daily' : ''}`;
}

export interface DayRow { owner_id: string; kind: string; state: string; detail?: string | null; key_source?: string | null }
export interface DailyState {
  /** False when the usage log could not be read (migration pending): nothing is skipped or capped. */
  tracking: boolean;
  own: { ttsUsed: number; ttsExhausted: string[]; transcribeUsed: number; transcribeExhausted: boolean };
  shared: { transcribeUsed: number; transcribeUsedAll: number; ttsExhausted: string[]; transcribeExhausted: boolean };
  elevenlabsAlignUsed: number;
}

const parts = (detail?: string | null) => (detail || '').split(' · ');
const isDaily = (row: DayRow) => row.state === 'failed' && / · daily$/.test(row.detail || '');
/** A request rejected with 429 never consumed quota; everything else did. */
const consumed = (row: DayRow) => parts(row.detail)[1] !== '429';

export function summarizeDay(rows: DayRow[], ownerId: string): DailyState {
  const state: DailyState = {
    tracking: true,
    own: { ttsUsed: 0, ttsExhausted: [], transcribeUsed: 0, transcribeExhausted: false },
    shared: { transcribeUsed: 0, transcribeUsedAll: 0, ttsExhausted: [], transcribeExhausted: false },
    elevenlabsAlignUsed: 0,
  };
  for (const row of rows) {
    const mine = row.owner_id === ownerId;
    const model = parts(row.detail)[0];
    if (row.kind === 'elevenlabs_align') { if (mine) state.elevenlabsAlignUsed++; continue; }
    if (row.key_source === 'teacher') {
      if (!mine) continue;
      if (row.kind === 'gemini_tts') {
        if (consumed(row)) state.own.ttsUsed++;
        if (isDaily(row) && !state.own.ttsExhausted.includes(model)) state.own.ttsExhausted.push(model);
      } else if (row.kind === 'gemini_transcribe') {
        if (consumed(row)) state.own.transcribeUsed++;
        if (isDaily(row)) state.own.transcribeExhausted = true;
      }
    } else if (row.key_source === 'system') {
      if (row.kind === 'gemini_tts' && isDaily(row) && !state.shared.ttsExhausted.includes(model)) state.shared.ttsExhausted.push(model);
      if (row.kind === 'gemini_transcribe') {
        if (consumed(row)) { state.shared.transcribeUsedAll++; if (mine) state.shared.transcribeUsed++; }
        if (isDaily(row)) state.shared.transcribeExhausted = true;
      }
    }
  }
  return state;
}

export async function readDailyState(db: any, ownerId: string, nowIso = new Date().toISOString()): Promise<DailyState> {
  const rows: DayRow[] = [];
  const since = pacificDayStart(nowIso);
  const untracked = { ...summarizeDay([], ownerId), tracking: false };
  try {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('activity').select('owner_id,kind,state,detail,key_source')
        .in('kind', ['gemini_tts', 'gemini_transcribe', 'elevenlabs_align']).gte('created_at', since)
        .order('created_at', { ascending: true }).range(from, from + 999);
      if (error) return untracked;
      rows.push(...(data || []));
      if ((data || []).length < 1000) break;
    }
  } catch {
    return untracked;
  }
  return summarizeDay(rows, ownerId);
}

/** Per-teacher caps apply to teachers only; the studio owner's admins are not capped. */
export const isCapped = (member: { profile?: { role?: string } | null }) => member.profile?.role !== 'admin';

export function sharedTranscribeAllowed(state: DailyState, capped: boolean): boolean {
  return !state.shared.transcribeExhausted && (!capped || state.shared.transcribeUsed < SHARED_TRANSCRIBE_PER_TEACHER);
}
export function elevenLabsAlignAllowed(state: DailyState, capped: boolean): boolean {
  return !capped || state.elevenlabsAlignUsed < ELEVENLABS_ALIGN_PER_TEACHER;
}

// ---- Teacher key storage (AES-256-GCM, server-only) ----

function encryptionKey(): Buffer | null {
  const secret = (process.env.GEMINI_KEY_ENCRYPTION_SECRET || '').trim();
  return secret.length >= 16 ? createHash('sha256').update(secret).digest() : null;
}
export const keyStorageReady = () => encryptionKey() !== null;

export function encryptKey(plain: string): string {
  const key = encryptionKey();
  if (!key) throw new Error('GEMINI_KEY_ENCRYPTION_SECRET is not configured.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}

export function decryptKey(stored: string): string | null {
  const key = encryptionKey();
  const [version, iv, tag, body] = (stored || '').split(':');
  if (!key || version !== 'v1' || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** The teacher's own key, or null when none is saved, it was marked invalid or cannot be decrypted. */
export async function readTeacherKey(db: any, ownerId: string): Promise<string | null> {
  try {
    const { data, error } = await db.from('teacher_gemini_keys').select('ciphertext,status').eq('owner_id', ownerId).maybeSingle();
    if (error || !data || data.status !== 'active') return null;
    return decryptKey(data.ciphertext);
  } catch {
    return null;
  }
}

/** Google rejected the key itself (not a quota or model problem). */
export function isInvalidKeyError(status: number, raw: string): boolean {
  return status === 401 || /API_KEY_INVALID|API key not valid|API key expired/i.test(raw || '');
}

export async function markTeacherKeyInvalid(db: any, ownerId: string): Promise<void> {
  try { await db.from('teacher_gemini_keys').update({ status: 'invalid', updated_at: new Date().toISOString() }).eq('owner_id', ownerId); } catch {}
}
