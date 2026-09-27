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

export async function saveStudioSettings(settings: Omit<StudioSettings, 'updated_at'>): Promise<void> {
  const { error } = await database().from('studio_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) throw new Error(friendly(error));
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
