import { messageOf } from './http.js';
import { serviceDatabase } from './auth.js';

export type UsageKind = 'gemini_tts' | 'gemini_transcribe' | 'elevenlabs_align';
export interface UsageEvent {
  kind: UsageKind;
  state: 'succeeded' | 'failed';
  /** Model name and upstream HTTP status, e.g. "gemini-3.8-flash-tts · 429". */
  detail?: string;
  characters?: number;
  /** Which Google key served the request: the teacher's own or the studio's shared key. */
  keySource?: 'teacher' | 'system';
}

/**
 * Logs every upstream request as its own activity row (admin quota view).
 * Best effort: a missing migration or database hiccup never blocks narration.
 */
export async function recordUsage(ownerId: string, projectId: string | undefined, events: UsageEvent[]): Promise<void> {
  if (!events.length) return;
  try {
    const db = serviceDatabase();
    const rows = events.map(e => ({ owner_id: ownerId, project_id: projectId || null, kind: e.kind, state: e.state,
      characters: Math.max(0, Math.round(e.characters || 0)), detail: (e.detail || '').slice(0, 300) || null, ...(e.keySource ? { key_source: e.keySource } : {}) }));
    let { error } = await db.from('activity').insert(rows);
    // A project id that is not (yet) saved must not lose the count.
    if (error && projectId) ({ error } = await db.from('activity').insert(rows.map(r => ({ ...r, project_id: null }))));
    // Before 20260928_teacher_keys.sql there is no key_source column.
    if (error) ({ error } = await db.from('activity').insert(rows.map(({ key_source, ...r }: any) => ({ ...r, project_id: null }))));
    if (error) console.warn('[usage] not recorded:', error.message);
  } catch (error) {
    console.warn('[usage] not recorded:', messageOf(error) || error);
  }
}

/**
 * Holds one of a teacher's capped requests for today before it is made. The row is written first
 * and counted after, so requests sent at the same moment cannot all slip under the cap: when the
 * count is over, the row is taken back and the request refused. When the row cannot be written
 * or counted, the request goes ahead untracked, as recordUsage would have let it.
 */
export async function holdUsage(db: any, ownerId: string, projectId: string | undefined, kind: UsageKind, sinceIso: string, cap: number, characters = 0):
  Promise<{ allowed: boolean; id: string | null }> {
  try {
    const { data, error } = await db.from('activity')
      .insert({ owner_id: ownerId, project_id: projectId || null, kind, state: 'reserved', characters: Math.max(0, Math.round(characters)) })
      .select('id').single();
    const id: string | null = !error && data?.id ? String(data.id) : null;
    if (!id) return { allowed: true, id: null };
    const { count, error: countError } = await db.from('activity').select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId).eq('kind', kind).gte('created_at', sinceIso);
    if (countError || typeof count !== 'number') return { allowed: true, id };
    if (count > cap) {
      await db.from('activity').delete().eq('id', id);
      return { allowed: false, id: null };
    }
    return { allowed: true, id };
  } catch {
    return { allowed: true, id: null };
  }
}

/** Writes the outcome onto a held row (or logs a new row when nothing was held). */
export async function settleUsage(db: any, heldId: string | null, ownerId: string, projectId: string | undefined, event: UsageEvent): Promise<void> {
  if (heldId) {
    try {
      const { error } = await db.from('activity').update({ state: event.state, detail: (event.detail || '').slice(0, 300) || null,
        characters: Math.max(0, Math.round(event.characters || 0)) }).eq('id', heldId);
      if (!error) return;
    } catch { /* logged as a new row below */ }
  }
  await recordUsage(ownerId, projectId, [event]);
}
