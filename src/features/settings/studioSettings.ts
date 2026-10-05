import { useEffect, useState } from 'react';
import { database, supabase } from '../../services/supabase';
import type { UserPreferences } from './preferences';

/** Shown until supabase/migrations/20261001_settings.sql has been run. */
export const MIGRATION_PENDING = 'Bu ayar için veritabanı güncellemesi bekleniyor. Yönetici SQL dosyasını çalıştırınca açılır.';

/** A missing table/column/function (PostgREST or Postgres codes) means the migration is not run yet. */
export function isMigrationPending(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883'].includes(error.code || '')
    || /does not exist|could not find/i.test(error.message || '');
}

const friendly = (error: { code?: string; message?: string }) => isMigrationPending(error) ? MIGRATION_PENDING : (error.message || 'Kaydedilemedi.');

export async function saveMyProfile(name: string, preferences: UserPreferences): Promise<void> {
  const { error } = await database().rpc('update_my_profile', { new_name: name.trim(), new_preferences: preferences });
  if (error) throw new Error(friendly(error));
}

export interface StudioSettings {
  announcement: string;
  announcement_active: boolean;
  /** When the announcement stops showing; null = until withdrawn (column added by 20261004_announcement_until.sql). */
  announcement_until?: string | null;
  shared_transcribe_per_teacher: number;
  elevenlabs_align_per_teacher: number;
  auto_approve: string[];
  signups_open: boolean;
  updated_at?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, DOMAIN = /^@[^\s@]+\.[^\s@]+$/;

/** One address or "@domain" per line (commas also work); returns the clean list and anything unreadable. */
export function parseAutoApprove(text: string): { entries: string[]; invalid: string[] } {
  const items = text.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const entries = [...new Set(items.filter(s => EMAIL.test(s) || DOMAIN.test(s)))];
  return { entries, invalid: items.filter(s => !EMAIL.test(s) && !DOMAIN.test(s)) };
}

/** Admin only (RLS). Null with pending=true before the migration. */
export async function loadStudioSettings(): Promise<{ settings: StudioSettings | null; pending: boolean }> {
  const { data, error } = await database().from('studio_settings').select('*').maybeSingle();
  if (error) {
    if (isMigrationPending(error)) return { settings: null, pending: true };
    throw new Error(error.message);
  }
  return { settings: data as StudioSettings | null, pending: !data };
}

export async function saveStudioSettings(settings: Partial<Omit<StudioSettings, 'updated_at'>>): Promise<void> {
  const { error } = await database().from('studio_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) throw new Error(friendly(error));
}

export const ANNOUNCEMENT_DURATIONS = [
  { label: '24 saat', hours: 24 },
  { label: '3 gün', hours: 72 },
  { label: '7 gün', hours: 168 },
  { label: 'Süresiz', hours: 0 },
] as const;

export const announcementUntil = (hours: number, now = Date.now()) => hours > 0 ? new Date(now + hours * 3600_000).toISOString() : null;

/** What members see right now: live, expired (still switched on but past its end) or off. */
export function announcementState(s: Pick<StudioSettings, 'announcement' | 'announcement_active' | 'announcement_until'>, now = Date.now()): 'live' | 'expired' | 'off' {
  if (!s.announcement_active || !s.announcement.trim()) return 'off';
  return s.announcement_until && Date.parse(s.announcement_until) <= now ? 'expired' : 'live';
}

/** Longest announcement (20261011_announcement_length.sql); before that migration the database allows 500. */
export const ANNOUNCEMENT_MAX = 5000;
const ANNOUNCEMENT_OLD_MAX = 500;

/**
 * Publish, withdraw or delete the announcement without touching the other settings.
 * Before the expiry migration the end time is dropped and the announcement stays until withdrawn.
 */
export async function updateAnnouncement(patch: Pick<StudioSettings, 'announcement' | 'announcement_active' | 'announcement_until'>): Promise<{ patch: Partial<StudioSettings>; expiryPending: boolean }> {
  const row = { ...patch, updated_at: new Date().toISOString() };
  let { error } = await database().from('studio_settings').update(row).eq('id', true);
  if (error && isMigrationPending(error) && 'announcement_until' in row) {
    const { announcement_until: _dropped, ...rest } = row;
    ({ error } = await database().from('studio_settings').update(rest).eq('id', true));
    if (!error) return { patch: { ...rest, announcement_until: null }, expiryPending: true };
  }
  if (error?.code === '23514' && patch.announcement.length > ANNOUNCEMENT_OLD_MAX) {
    throw new Error(`Duyuru ${ANNOUNCEMENT_OLD_MAX} karakterden uzun. Daha uzun duyuru için veritabanı güncellemesi bekleniyor (supabase/migrations/20261011_announcement_length.sql); o zamana kadar kısaltın.`);
  }
  if (error) throw new Error(friendly(error));
  return { patch: row, expiryPending: false };
}

/** The active announcement for approved members, or null (also before the migration). */
export async function loadAnnouncement(): Promise<{ text: string; updatedAt: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('studio_announcement');
  const row = !error && Array.isArray(data) ? data[0] : null;
  return row?.announcement ? { text: row.announcement, updatedAt: row.updated_at } : null;
}

/** Whether new accounts may be created; open when unknown so the page never locks people out by mistake. */
export async function signupsOpen(): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { data, error } = await supabase.rpc('studio_signups_open');
    return error ? true : data !== false;
  } catch { return true; }
}

export function useSignupsOpen(): boolean {
  const [open, setOpen] = useState(true);
  useEffect(() => { let live = true; void signupsOpen().then(v => { if (live) setOpen(v); }); return () => { live = false; }; }, []);
  return open;
}
