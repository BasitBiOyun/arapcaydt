-- Teacher-owned Google AI Studio keys (each teacher's own free quota) and
-- the per-request key source used for daily quota tracking.
-- Safe to run more than once; it also contains 20260927_voice_usage.sql, so
-- running only this file is enough.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('voice','video_export','member_status','gemini_tts','gemini_transcribe','elevenlabs_align'));
alter table public.activity add column if not exists detail text;
create index if not exists activity_kind_date on public.activity(kind, created_at desc);

-- 'teacher' = the member's own key, 'system' = the studio's shared key.
alter table public.activity add column if not exists key_source text;
alter table public.activity drop constraint if exists activity_key_source_check;
alter table public.activity add constraint activity_key_source_check check (key_source is null or key_source in ('teacher','system'));

-- The key is AES-256-GCM encrypted on the server (GEMINI_KEY_ENCRYPTION_SECRET).
-- Only the service role reads this table; browsers never see a key, not even their own.
create table if not exists public.teacher_gemini_keys (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  ciphertext text not null,
  last4 text not null,
  status text not null default 'active' check (status in ('active','invalid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.teacher_gemini_keys enable row level security;
revoke all on public.teacher_gemini_keys from anon, authenticated;
grant all on public.teacher_gemini_keys to service_role;
