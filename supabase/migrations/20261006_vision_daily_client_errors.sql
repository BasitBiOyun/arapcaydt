-- 1) Google Vision: besides the monthly limit, each teacher gets a daily number of readings
--    (VISION_DAILY_PER_TEACHER, default 30; Türkiye day). Past it the in-browser reader is used.
-- 2) Errors in teachers' browsers (preparing marks, making the MP4) are recorded as activity
--    'client_error' so they show in the admin panel without a "Sorun bildir".
-- Needs 20261005_vision_quota.sql first. Safe to run more than once.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('voice','video_export','member_status','gemini_tts','gemini_transcribe','elevenlabs_align','vision_ocr','client_error'));

-- Returns the month's count including this reading; -1 when the month is full, -2 when the
-- teacher's day is full (p_daily null: no daily limit, e.g. for admins).
create or replace function public.reserve_vision(p_owner uuid, p_limit integer, p_daily integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
  used integer;
  today integer;
begin
  perform pg_advisory_xact_lock(hashtext('reserve_vision'));
  select count(*) into used from public.activity where kind = 'vision_ocr' and created_at >= month_start;
  if used >= p_limit then return -1; end if;
  if p_daily is not null then
    select count(*) into today from public.activity where kind = 'vision_ocr' and owner_id = p_owner and created_at >= day_start;
    if today >= p_daily then return -2; end if;
  end if;
  insert into public.activity(owner_id, kind, state) values (p_owner, 'vision_ocr', 'reserved');
  return used + 1;
end; $$;
revoke all on function public.reserve_vision(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_vision(uuid, integer, integer) to service_role;

-- A teacher's browser reports an error (at most 50 a day per teacher).
create or replace function public.record_client_error(project_id text, stage text, message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved() then return; end if;
  if (select count(*) from public.activity where owner_id = auth.uid() and kind = 'client_error'
      and created_at >= now() - interval '1 day') >= 50 then return; end if;
  insert into public.activity(owner_id, project_id, kind, state, detail)
  values (auth.uid(), (select p.id from public.projects p where p.id = record_client_error.project_id and p.owner_id = auth.uid()),
          'client_error', left(coalesce(stage, ''), 40), left(coalesce(message, ''), 300));
end; $$;
revoke all on function public.record_client_error(text, text, text) from public, anon;
grant execute on function public.record_client_error(text, text, text) to authenticated;
