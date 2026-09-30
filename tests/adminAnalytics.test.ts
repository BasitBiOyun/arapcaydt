import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProjects, CURRENT_PIPELINE_VERSION, type ProjectRow } from '../api/admin/analytics';
import { CURRENT_PIPELINE_VERSION as EDITOR_VERSION } from '../src/features/question-editor/readiness';

const options = ['option-a', 'option-b', 'option-c', 'option-d', 'option-e'];
const row = (id: string, over: Partial<ProjectRow> = {}): ProjectRow => ({
  id, owner_id: 't1', updated_at: `2026-09-2${id.slice(-1)}T10:00:00+00:00`, title: `Soru ${id}`, category: 'soru-coz',
  status: 'video_ready', videoReady: true, correctAnswer: 'C', pipelineVersion: CURRENT_PIPELINE_VERSION, timingQuality: 'word-aligned',
  regionIds: options, actions: [{ type: 'correct', targetRegionId: 'option-c' }], warnings: [], ...over,
});

test('admin analytics counts engines, Gemini models, fallbacks and timestamp sources from project audio', () => {
  const s = summarizeProjects([
    row('p1', { narrationType: 'gemini', modelId: 'gemini-3.8-flash-lite-tts', timingSource: 'gemini-transcribe' }),
    row('p2', { narrationType: 'gemini', modelId: 'gemini-3.8-flash-tts', timingSource: 'forced-alignment' }),
    row('p3', { narrationType: 'elevenlabs', fallbackReason: 'Gemini TTS başarısız. HTTP 429' }),
    row('p4', { narrationType: 'uploaded', timingSource: 'whisper' }),
    row('p5', { legacyModelId: 'eleven_multilingual_v2', actions: [] }),
    row('p6', { status: 'draft', videoReady: false, actions: [] }),
  ]);
  assert.deepEqual({ g: s.voice.gemini, e: s.voice.elevenlabs, f: s.voice.geminiFallbacks, u: s.voice.uploaded, n: s.voice.none }, { g: 2, e: 2, f: 1, u: 1, n: 1 });
  assert.deepEqual(s.voice.models, { 'gemini-3.8-flash-lite-tts': 1, 'gemini-3.8-flash-tts': 1 });
  assert.deepEqual(s.voice.timing, { 'gemini-transcribe': 1, 'forced-alignment': 1, 'elevenlabs-tts': 2, whisper: 1 });
  assert.deepEqual(s.funnel, { total: 6, withAudio: 5, withMarkers: 4, ready: 4 });
  assert.equal(s.members.t1.gemini, 2);
  assert.equal(s.members.t1.geminiFallbacks, 1);
  assert.ok(s.issues.some(i => i.projectId === 'p3' && i.detail.includes('ElevenLabs yedeği')));
});

test('admin quality mirrors the editor publish check', () => {
  assert.equal(CURRENT_PIPELINE_VERSION, EDITOR_VERSION, 'server and editor plan versions must match');
  const s = summarizeProjects([
    row('p1'),
    row('p2', { actions: [{ type: 'correct', targetRegionId: 'option-b' }] }),
    row('p3', { pipelineVersion: 4 }),
    row('p4', { timingQuality: 'anchored' }),
    row('p5', { regionIds: options.slice(0, 4) }),
    row('p6', { regionIds: options.slice(0, 3) }),
    row('p7', { narrationType: 'gemini', timingSource: 'none', warnings: ['Görselde eşleştirilemeyen Arapça kelimeler: فِي.'] }),
  ]);
  assert.deepEqual(s.quality, { ready: 2, check: 3, blocked: 2 });
  assert.ok(s.issues.some(i => i.projectId === 'p7' && i.detail.includes('kelime zamanı alınamadı')));
  assert.equal(s.issues.filter(i => i.detail.startsWith('Yayın kontrolü')).length, 2);
});

test('every request is counted separately, per service and Gemini model, on the Pacific quota day', async () => {
  const { summarizeRequests } = await import('../api/admin/analytics');
  const now = '2026-09-27T12:00:00Z'; // 05:00 in Los Angeles
  const rows = [
    { owner_id: 't1', kind: 'gemini_tts', state: 'failed', detail: 'gemini-3.8-flash-lite-tts · 429', created_at: '2026-09-27T11:00:00Z' },
    { owner_id: 't1', kind: 'gemini_tts', state: 'succeeded', detail: 'gemini-3.8-flash-tts', created_at: '2026-09-27T11:00:01Z' },
    { owner_id: 't1', kind: 'gemini_tts', state: 'succeeded', detail: 'gemini-3.8-flash-tts', created_at: '2026-09-27T06:00:00Z' }, // 23:00 previous Pacific day
    { owner_id: 't2', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', created_at: '2026-09-27T11:00:05Z' },
    { owner_id: 't2', kind: 'elevenlabs_align', state: 'failed', detail: 'forced-alignment · network', created_at: '2026-09-20T11:00:00Z' },
    { owner_id: 't2', kind: 'voice', state: 'succeeded', created_at: '2026-07-01T11:00:00Z' },
    { owner_id: 't2', kind: 'video_export', state: 'client_reported', created_at: '2026-09-27T11:00:00Z' },
  ];
  const r = summarizeRequests(rows, now);
  assert.equal(r.quotaDay, '2026-09-27');
  assert.deepEqual(r.totals.today.gemini_tts, { succeeded: 1, failed: 1 });
  assert.deepEqual(r.totals.all.gemini_tts, { succeeded: 2, failed: 1 });
  assert.deepEqual(r.geminiModels['gemini-3.8-flash-tts'].today, { succeeded: 1, failed: 0 });
  assert.deepEqual(r.geminiModels['gemini-3.8-flash-lite-tts'].today, { succeeded: 0, failed: 1 });
  assert.deepEqual(r.totals.last30Days.elevenlabs_align, { succeeded: 0, failed: 1 });
  assert.deepEqual(r.totals.last30Days.voice, { succeeded: 0, failed: 0 });
  assert.deepEqual(r.totals.all.voice, { succeeded: 1, failed: 0 });
  assert.equal(r.members.t1.gemini_tts, 3);
  assert.equal(r.members.t2.gemini_transcribe, 1);
  // Last 7 days per teacher: successes next to failures.
  assert.deepEqual(r.membersWeek.t1, { voice: { succeeded: 2, failed: 1 }, timing: { succeeded: 0, failed: 0 } });
  assert.deepEqual(r.membersWeek.t2, { voice: { succeeded: 0, failed: 0 }, timing: { succeeded: 1, failed: 0 } }, 'the 20 Sep failure is older than 7 days');
});

test('usage migration applies on top of the membership schema and accepts the new request kinds', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFileSync } = await import('node:fs');
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  for (const file of ['20260921_membership.sql', '20260927_voice_usage.sql'])
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  const id = '00000000-0000-4000-8000-000000000009';
  await db.query(`insert into auth.users values ($1,'t@example.test',now(),'{}')`, [id]);
  await db.query(`insert into public.activity(owner_id,kind,state,detail) values ($1,'gemini_tts','succeeded','gemini-3.8-flash-tts'),($1,'gemini_transcribe','failed','gemini-3.5-transcribe · 429'),($1,'elevenlabs_align','succeeded',null)`, [id]);
  assert.equal((await db.query<any>(`select count(*)::int as n from public.activity`)).rows[0].n, 3);
  await assert.rejects(db.query(`insert into public.activity(owner_id,kind,state) values ($1,'something_else','x')`, [id]));
  // Re-running the migration is harmless.
  await db.exec(readFileSync(new URL('../supabase/migrations/20260927_voice_usage.sql', import.meta.url), 'utf8'));
});
