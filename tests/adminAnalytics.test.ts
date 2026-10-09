import test from 'node:test';
import assert from 'node:assert/strict';
import { clientErrorIssues, isCompleted, summarizeWeek, summarizeProjects, CURRENT_PIPELINE_VERSION, type ProjectRow } from '../api/admin/analytics';
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
  assert.deepEqual(s.funnel, { total: 6, withAudio: 5, withMarkers: 4, ready: 4, completed: 0 });
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

test('finished questions leave the checks and the attention list; an old MP4 download counts until reopened', () => {
  const blocked = (id: string, extra: Partial<ProjectRow> = {}): ProjectRow => ({ id, owner_id: 't1', updated_at: '2026-09-30T10:00:00Z', status: 'video_ready',
    correctAnswer: 'A', pipelineVersion: 1, actions: [{ type: 'correct', targetRegionId: 'option-a' }], regionIds: ['option-a'], ...extra });
  const s = summarizeProjects([
    blocked('done', { completedAt: '2026-09-30T11:00:00Z' }),
    blocked('old-export'),
    blocked('reopened', { reopenedAt: '2026-09-30T12:00:00Z' }),
    blocked('open'),
  ], { 'old-export': '2026-09-29T09:00:00Z', reopened: '2026-09-29T09:00:00Z' });
  assert.equal(s.funnel.completed, 2, 'marked done, and downloaded before marking existed');
  assert.equal(s.quality.blocked, 2, 'only the open ones are still to fix');
  assert.equal(s.members.t1.completed, 2);
  assert.deepEqual(s.issues.map(i => i.projectId).sort(), ['open', 'reopened'], 'finished questions are not in the attention list');
  assert.equal(isCompleted({ reopenedAt: '2026-09-30T12:00:00Z' }, '2026-09-30T13:00:00Z'), true, 'downloaded again after reopening');
});

test('browser failures appear in the attention list under their question', () => {
  const issues = clientErrorIssues([
    { project_id: 'p1', owner_id: 't1', state: 'mp4', detail: 'Video kodlayıcı açılamadı', created_at: '2026-09-30T10:00:00Z' },
    { project_id: null, owner_id: 't2', state: 'isaretler', detail: null, created_at: '2026-09-29T10:00:00Z' },
  ], [{ id: 'p1', title: 'Soru 12' }]);
  assert.deepEqual(issues.map(i => [i.title, i.detail]), [
    ['Soru 12', 'Tarayıcı hatası (MP4): Video kodlayıcı açılamadı'],
    ['Adsız proje', 'Tarayıcı hatası (İşaretler): ayrıntı yok'],
  ]);
});

test('this week: finished, worked on, and where the open questions wait, per teacher', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  const recent = '2026-09-29T10:00:00Z', old = '2026-09-01T10:00:00Z';
  const tick = [{ type: 'correct', targetRegionId: 'option-a' }];
  const week = summarizeWeek([
    { id: '1', owner_id: 't1', updated_at: recent, completedAt: recent },
    { id: '2', owner_id: 't1', updated_at: old, completedAt: old },
    { id: '3', owner_id: 't1', updated_at: recent },
    { id: '4', owner_id: 't1', updated_at: recent, narrationType: 'uploaded' },
    { id: '5', owner_id: 't1', updated_at: recent, narrationType: 'uploaded', correctAnswer: 'B', actions: tick, pipelineVersion: 5 },
    { id: '6', owner_id: 't2', updated_at: old },
  ], {}, [{ owner_id: 't2' }], now);
  assert.deepEqual(week.t1, { completed: 1, working: 3, needsVoice: 1, needsMarks: 1, needsFix: 1, errors: 0 });
  assert.deepEqual(week.t2, { completed: 0, working: 0, needsVoice: 0, needsMarks: 0, needsFix: 0, errors: 1 });
});

test('topics: questions and finished ones are counted per topic; untyped ones under the empty topic', () => {
  const s = summarizeProjects([
    row('a', { topic: 'İsm-i mevsul', completedAt: '2026-10-05T10:00:00Z' }),
    row('b', { topic: ' İsm-i mevsul ' }),
    row('c', { topic: 'Hal' }),
    row('d'),
  ]);
  assert.deepEqual(s.topicTotals, { 'İsm-i mevsul': { total: 2, completed: 1 }, Hal: { total: 1, completed: 0 }, '': { total: 1, completed: 0 } });
});

test('mark accuracy counts finished questions the teacher did not have to fix, and which fixes the others needed', async () => {
  const { markEdits } = await import('../api/admin/analytics');
  const plan = [{ id: 'a1', type: 'correct', targetRegionId: 'option-c' }];
  const row = (id: string, category: string, edits: ReturnType<typeof markEdits>): ProjectRow => ({
    id, owner_id: 't1', updated_at: '2026-10-01T00:00:00Z', category, completedAt: '2026-10-01T00:00:00Z', correctAnswer: 'C', actions: plan, edits,
  });
  const s = summarizeProjects([
    row('p1', 'nahiv', markEdits([{ id: 'option-c' }], plan, [])),
    row('p2', 'nahiv', markEdits([{ id: 'option-c', manuallyAdjusted: true }], plan, [])),
    row('p3', 'paragraf', markEdits([{ id: 'n1', shape: 'line', manuallyAdjusted: true }], [{ id: 'manual-1' }], ['keyword-2'])),
    row('p4', 'paragraf', markEdits([], [{ id: 'a1', retimed: true }], null)),
    // Not finished: not counted.
    { ...row('p5', 'nahiv', markEdits([], plan, [])), completedAt: null },
  ]);
  assert.deepEqual({ ...s.marks, byCategory: undefined }, { finished: 4, untouched: 1, moved: 1, added: 1, removed: 1, retimed: 1, byCategory: undefined });
  assert.deepEqual(s.marks.byCategory, { nahiv: { finished: 2, untouched: 1 }, paragraf: { finished: 2, untouched: 0 } });
});
