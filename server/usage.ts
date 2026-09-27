import { serviceDatabase } from './auth.js';

export type UsageKind = 'gemini_tts' | 'gemini_transcribe' | 'elevenlabs_align';
export interface UsageEvent {
  kind: UsageKind;
  state: 'succeeded' | 'failed';
  /** Model name and upstream HTTP status, e.g. "gemini-3.8-flash-tts · 429". */
  detail?: string;
  characters?: number;
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
      characters: Math.max(0, Math.round(e.characters || 0)), detail: (e.detail || '').slice(0, 300) || null }));
    let { error } = await db.from('activity').insert(rows);
    // A project id that is not (yet) saved must not lose the count.
    if (error && projectId) ({ error } = await db.from('activity').insert(rows.map(r => ({ ...r, project_id: null }))));
    if (error) console.warn('[usage] not recorded:', error.message);
  } catch (error: any) {
    console.warn('[usage] not recorded:', error?.message || error);
  }
}
