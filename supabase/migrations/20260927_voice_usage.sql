-- Per-request usage log for the Gemini-first narration stack.
-- Every upstream request is one activity row: each Gemini TTS model attempt
-- (successful or not), each Gemini Transcribe call and each ElevenLabs
-- Forced Alignment call. `detail` holds the model name and HTTP status.
-- ElevenLabs TTS keeps using kind 'voice' through reserve_voice (its daily
-- limit and 10 s spacing count only 'voice' rows and are unchanged).
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('voice','video_export','member_status','gemini_tts','gemini_transcribe','elevenlabs_align'));
alter table public.activity add column if not exists detail text;
create index if not exists activity_kind_date on public.activity(kind, created_at desc);
