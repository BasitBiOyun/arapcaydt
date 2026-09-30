-- Google Cloud Vision picture reading: counted per calendar month (Pacific time, as Google bills).
-- The first 1000 readings a month are free; the studio stops at a limit below that
-- (VISION_MONTHLY_LIMIT, default 950) and reads with the in-browser reader instead.
-- Safe to run more than once.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('voice','video_export','member_status','gemini_tts','gemini_transcribe','elevenlabs_align','vision_ocr'));

-- Reserves one reading if this month is under the limit: returns the month's count including it,
-- or -1 when the limit is reached. One at a time (advisory lock), so the limit is never passed.
create or replace function public.reserve_vision(p_owner uuid, p_limit integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext('reserve_vision'));
  select count(*) into used from public.activity where kind = 'vision_ocr' and created_at >= month_start;
  if used >= p_limit then return -1; end if;
  insert into public.activity(owner_id, kind, state) values (p_owner, 'vision_ocr', 'reserved');
  return used + 1;
end; $$;
revoke all on function public.reserve_vision(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_vision(uuid, integer) to service_role;
