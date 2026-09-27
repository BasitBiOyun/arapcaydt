import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEVENLABS_ALIGN_PER_TEACHER, SHARED_TRANSCRIBE_PER_TEACHER, decryptKey, elevenLabsAlignAllowed, encryptKey, isCapped,
  isDailyQuotaError, isInvalidKeyError, pacificDayStart, readDailyState, sharedTranscribeAllowed, summarizeDay, usageDetail, type DayRow,
} from '../server/quota';
import { isGoogleKeyShape } from '../api/gemini/key';
import { summarizeRequests } from '../api/admin/analytics';
import { capacityLine, type TeacherKeyStatus } from '../src/services/narration/geminiKeyService';

test('the quota day starts at Pacific midnight in both summer and winter time', () => {
  assert.equal(pacificDayStart('2026-09-27T20:00:00Z'), '2026-09-27T07:00:00.000Z');
  assert.equal(pacificDayStart('2026-09-28T06:59:00Z'), '2026-09-27T07:00:00.000Z');
  assert.equal(pacificDayStart('2026-12-15T12:00:00Z'), '2026-12-15T08:00:00.000Z');
});

test('only per-day 429s (or a free-tier limit of 0) mark a model exhausted for the day', () => {
  assert.equal(isDailyQuotaError(429, '{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}'), true);
  assert.equal(isDailyQuotaError(429, 'Quota exceeded for metric ..., limit: 0, model: x'), true);
  assert.equal(isDailyQuotaError(429, '{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}'), false);
  assert.equal(isDailyQuotaError(500, 'PerDay'), false);
  assert.equal(usageDetail('m', 429, true), 'm · 429 · daily');
  assert.equal(isInvalidKeyError(400, '{"reason":"API_KEY_INVALID"}'), true);
  assert.equal(isInvalidKeyError(429, 'Resource exhausted'), false);
});

const rows: DayRow[] = [
  // Teacher t1, own key: two TTS successes, one model out of daily quota, Transcribe once then exhausted.
  { owner_id: 't1', kind: 'gemini_tts', state: 'succeeded', detail: 'gemini-3.8-flash-tts', key_source: 'teacher' },
  { owner_id: 't1', kind: 'gemini_tts', state: 'succeeded', detail: 'gemini-3.8-flash-tts', key_source: 'teacher' },
  { owner_id: 't1', kind: 'gemini_tts', state: 'failed', detail: 'gemini-3.8-flash-lite-tts · 429 · daily', key_source: 'teacher' },
  { owner_id: 't1', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', key_source: 'teacher' },
  { owner_id: 't1', kind: 'gemini_transcribe', state: 'failed', detail: 'gemini-3.5-transcribe · 429 · daily', key_source: 'teacher' },
  // Studio key: t1 used it twice for timing (one per-minute 429 does not count), t2 once; a studio TTS model is out.
  { owner_id: 't1', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', key_source: 'system' },
  { owner_id: 't1', kind: 'gemini_transcribe', state: 'failed', detail: 'gemini-3.5-transcribe · 500', key_source: 'system' },
  { owner_id: 't1', kind: 'gemini_transcribe', state: 'failed', detail: 'gemini-3.5-transcribe · 429', key_source: 'system' },
  { owner_id: 't2', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', key_source: 'system' },
  { owner_id: 't2', kind: 'gemini_tts', state: 'failed', detail: 'gemini-2.5-flash-preview-tts · 429 · daily', key_source: 'system' },
  // Another teacher's own key never affects t1.
  { owner_id: 't2', kind: 'gemini_transcribe', state: 'failed', detail: 'gemini-3.5-transcribe · 429 · daily', key_source: 'teacher' },
  { owner_id: 't1', kind: 'elevenlabs_align', state: 'succeeded', detail: 'forced-alignment · 200' },
];

test('daily state separates the teacher key, the studio key and ElevenLabs', () => {
  const t1 = summarizeDay(rows, 't1');
  assert.deepEqual(t1.own, { ttsUsed: 2, ttsExhausted: ['gemini-3.8-flash-lite-tts'], transcribeUsed: 1, transcribeExhausted: true });
  assert.deepEqual(t1.shared, { transcribeUsed: 2, transcribeUsedAll: 3, ttsExhausted: ['gemini-2.5-flash-preview-tts'], transcribeExhausted: false });
  assert.equal(t1.elevenlabsAlignUsed, 1);
  const t2 = summarizeDay(rows, 't2');
  assert.equal(t2.own.transcribeExhausted, true);
  assert.equal(t2.own.ttsUsed, 0);
});

test('shared Transcribe and ElevenLabs caps apply to teachers only', () => {
  const full = summarizeDay(Array.from({ length: SHARED_TRANSCRIBE_PER_TEACHER }, () => (
    { owner_id: 't1', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', key_source: 'system' })), 't1');
  assert.equal(sharedTranscribeAllowed(full, true), false);
  assert.equal(sharedTranscribeAllowed(full, false), true);
  assert.equal(sharedTranscribeAllowed(summarizeDay(rows, 't1'), true), true);
  const studioOut = summarizeDay([{ owner_id: 't9', kind: 'gemini_transcribe', state: 'failed', detail: 'gemini-3.5-transcribe · 429 · daily', key_source: 'system' }], 'admin');
  assert.equal(sharedTranscribeAllowed(studioOut, false), false, 'an exhausted studio key is skipped even for admins');
  const eleven = summarizeDay(Array.from({ length: ELEVENLABS_ALIGN_PER_TEACHER }, () => ({ owner_id: 't1', kind: 'elevenlabs_align', state: 'failed', detail: 'forced-alignment · 500' })), 't1');
  assert.equal(elevenLabsAlignAllowed(eleven, true), false);
  assert.equal(elevenLabsAlignAllowed(eleven, false), true);
  assert.equal(isCapped({ profile: { role: 'teacher' } }), true);
  assert.equal(isCapped({ profile: { role: 'admin' } }), false);
});

test('an unreadable usage log never blocks narration', async () => {
  const broken = { from() { throw new Error('no table'); } };
  const state = await readDailyState(broken, 't1');
  assert.equal(state.tracking, false);
  assert.equal(sharedTranscribeAllowed(state, true), true);
  assert.equal(elevenLabsAlignAllowed(state, true), true);
  assert.equal((await readDailyState(null, 't1')).tracking, false);
});

test('teacher keys are encrypted with a random IV and tampering is rejected', () => {
  const previous = process.env.GEMINI_KEY_ENCRYPTION_SECRET;
  process.env.GEMINI_KEY_ENCRYPTION_SECRET = 'test-secret-that-is-long-enough';
  try {
    const key = 'AIza' + 'x'.repeat(35);
    const a = encryptKey(key), b = encryptKey(key);
    assert.notEqual(a, b);
    assert.ok(!a.includes(key));
    assert.equal(decryptKey(a), key);
    const parts = a.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    assert.equal(decryptKey(parts.join(':')), null);
    process.env.GEMINI_KEY_ENCRYPTION_SECRET = 'a-different-secret-entirely';
    assert.equal(decryptKey(a), null);
    delete process.env.GEMINI_KEY_ENCRYPTION_SECRET;
    assert.throws(() => encryptKey(key));
  } finally {
    if (previous === undefined) delete process.env.GEMINI_KEY_ENCRYPTION_SECRET; else process.env.GEMINI_KEY_ENCRYPTION_SECRET = previous;
  }
  assert.equal(isGoogleKeyShape('AIza' + 'A1_-'.repeat(8) + 'abc'), true);
  assert.equal(isGoogleKeyShape('sk-' + 'x'.repeat(40)), false);
  assert.equal(isGoogleKeyShape('AIza short'), false);
});

test('admin request summary shows each teacher’s key chain for today', () => {
  const now = '2026-09-27T20:00:00Z';
  const withDates = rows.map(r => ({ ...r, created_at: '2026-09-27T15:00:00Z' }));
  withDates.push({ owner_id: 't1', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', key_source: 'system', created_at: '2026-09-26T15:00:00Z' });
  const s = summarizeRequests(withDates, now);
  assert.equal(s.studio.transcribeUsed, 3, 'yesterday’s studio request is not today');
  assert.deepEqual(s.studio.ttsExhausted, ['gemini-2.5-flash-preview-tts']);
  assert.equal(s.membersToday.t1.sharedTranscribe, 2);
  assert.equal(s.membersToday.t1.ownTts, 2);
  assert.equal(s.membersToday.t1.ownTtsExhausted, 1);
  assert.equal(s.membersToday.t1.ownTranscribeExhausted, true);
  assert.equal(s.membersToday.t2.sharedTranscribe, 1);
  assert.deepEqual(s.limits, { sharedTranscribePerTeacher: SHARED_TRANSCRIBE_PER_TEACHER, elevenlabsAlignPerTeacher: ELEVENLABS_ALIGN_PER_TEACHER });
});

test('the audio step tells the teacher in one sentence which capacity is used', () => {
  const base: TeacherKeyStatus = { storageReady: true, key: { last4: 'a3F9', status: 'active', updatedAt: '' }, today: {
    tracking: true, tts: { used: 0, exhaustedModels: 0, models: 4 }, transcribe: { used: 0, exhausted: false },
    shared: { used: 0, limit: 25, exhausted: false }, elevenlabs: { used: 0, limit: 20 } } };
  assert.match(capacityLine(base)!, /Kendi Google anahtarınızla/);
  assert.match(capacityLine({ ...base, key: null })!, /Ortak kapasite/);
  assert.match(capacityLine({ ...base, key: { ...base.key!, status: 'invalid' } })!, /geçersiz/);
  assert.match(capacityLine({ ...base, today: { ...base.today, tts: { used: 40, exhaustedModels: 4, models: 4 } } })!, /seslendirme hakkınız doldu/);
  assert.equal(capacityLine(null), null);
});

test('teacher key migration applies on the membership schema alone, is re-runnable and hides keys from browsers', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFileSync } = await import('node:fs');
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  const migration = readFileSync(new URL('../supabase/migrations/20260928_teacher_keys.sql', import.meta.url), 'utf8');
  await db.exec(readFileSync(new URL('../supabase/migrations/20260921_membership.sql', import.meta.url), 'utf8'));
  await db.exec(migration);
  await db.exec(migration);
  const id = '00000000-0000-4000-8000-000000000011';
  await db.query(`insert into auth.users values ($1,'k@example.test',now(),'{}')`, [id]);
  await db.query(`insert into public.activity(owner_id,kind,state,detail,key_source) values ($1,'gemini_transcribe','succeeded','gemini-3.5-transcribe · 200','teacher'),($1,'gemini_tts','failed','m · 429 · daily','system'),($1,'elevenlabs_align','succeeded',null,null)`, [id]);
  await assert.rejects(db.query(`insert into public.activity(owner_id,kind,state,key_source) values ($1,'gemini_tts','x','someone-else')`, [id]));
  await db.query(`insert into public.teacher_gemini_keys(owner_id,ciphertext,last4) values ($1,'v1:a:b:c','a3F9')`, [id]);
  await assert.rejects(db.query(`insert into public.teacher_gemini_keys(owner_id,ciphertext,last4,status) values ($1,'x','y','stolen')`, [id]));
  const noSvg = readFileSync(new URL('../supabase/migrations/20260929_no_svg_uploads.sql', import.meta.url), 'utf8');
  await db.exec(noSvg);
  await db.exec(noSvg);
  const types = (await db.query<any>(`select allowed_mime_types from storage.buckets where id='project-assets'`)).rows[0].allowed_mime_types;
  assert.ok(!types.includes('image/svg+xml') && types.includes('image/png') && types.includes('audio/mpeg'));
  await db.exec(`set role authenticated`);
  await assert.rejects(db.query(`select * from public.teacher_gemini_keys`), /permission denied/);
  await db.exec(`reset role`);
});

test('when every voice service fails the teacher sees one plain sentence, not the technical chain', async () => {
  const { narrationService, VoiceUnavailableError } = await import('../src/services/narration/narrationService');
  const error = await narrationService.generateNarration({ projectId: 'p1', text: 'Doğru cevap C.' } as any).catch(e => e);
  assert.ok(error instanceof VoiceUnavailableError);
  assert.equal(error.message, 'Şu anda ses üretilemedi. Birkaç dakika sonra tekrar deneyin.');
  assert.match(error.detail, /ElevenLabs yedeği de başarısız/);
  assert.match(new VoiceUnavailableError('x', 'Günlük öğretmen ses sınırına ulaşıldı').message, /Bugünkü ses üretim hakları doldu/);
  assert.equal(new VoiceUnavailableError('x', 'Oturumunuz sona erdi. Yeniden giriş yapın.').message, 'Oturumunuz sona erdi. Yeniden giriş yapın.');
});
