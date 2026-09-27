import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCODER_DELAY_SAMPLES, pcmFromRaw, pcmFromWav, storedNarrationAudio, trimEncoderDelay } from '../server/mp3';
import { convertibleAudio, orphans, referencedPaths, summarizeStorage, ORPHAN_MIN_AGE_MS, type StoredObject } from '../server/storage';

function wav(samples: Int16Array, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const data = Buffer.alloc(samples.length * 2 * channels);
  samples.forEach((v, i) => { for (let c = 0; c < channels; c++) data.writeInt16LE(c === 0 ? v : -v, (i * channels + c) * 2); });
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2 * channels, 28); h.writeUInt16LE(2 * channels, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
process.env.SUPABASE_URL ||= 'https://db.example.test';
const tone = (seconds: number, rate = 24000, lead = 0.3) => {
  const s = new Int16Array(Math.round(seconds * rate));
  for (let i = Math.round(lead * rate); i < s.length; i++) s[i] = Math.round(9000 * Math.sin(i / 5) * Math.sin(i / 2000));
  return s;
};

test('WAV is read as 16-bit mono PCM (first channel of stereo) and other formats are refused', () => {
  const samples = Int16Array.from([0, 100, -200, 300]);
  assert.deepEqual([...pcmFromWav(wav(samples))!.samples], [0, 100, -200, 300]);
  assert.deepEqual([...pcmFromWav(wav(samples, 24000, 2))!.samples], [0, 100, -200, 300]);
  assert.equal(pcmFromWav(wav(samples, 24000, 1, 8)), null);
  assert.equal(pcmFromWav(Buffer.from('not a wav file at all, definitely not')), null);
  assert.deepEqual([...pcmFromRaw(Buffer.from(Int16Array.from([5, -5]).buffer), 24000).samples], [5, -5]);
});

test('narration is stored as a much smaller MP3 and falls back to WAV rather than losing audio', async () => {
  const source = wav(tone(20));
  const stored = await storedNarrationAudio(source);
  assert.equal(stored.mimeType, 'audio/mpeg');
  assert.equal(stored.extension, 'mp3');
  assert.equal(stored.bytes[0], 0xff, 'MPEG frame sync');
  assert.equal(stored.bytes[1] & 0xe0, 0xe0);
  assert.ok(stored.bytes.length < source.length / 5, `${stored.bytes.length} vs ${source.length}`);
  const eightBit = wav(Int16Array.from([1, 2, 3]), 24000, 1, 8);
  assert.deepEqual(await storedNarrationAudio(eightBit), { bytes: eightBit, mimeType: 'audio/wav', extension: 'wav' });
});

test('the encoder delay is trimmed only from a silent start', () => {
  // Measured with ffmpeg and Chromium: LAME output starts 1105 samples late; trimming makes the shift 0.00 ms.
  assert.equal(ENCODER_DELAY_SAMPLES, 1105);
  const quiet = tone(2);
  assert.equal(trimEncoderDelay(quiet).length, quiet.length - 1105);
  assert.equal(trimEncoderDelay(quiet)[0], quiet[1105]);
  const loud = tone(2, 24000, 0);
  assert.equal(trimEncoderDelay(loud), loud, 'speech from the first sample is never cut');
  const short = new Int16Array(500);
  assert.equal(trimEncoderDelay(short), short);
});

const day = 86400_000;
const now = Date.parse('2026-09-30T12:00:00Z');
const obj = (name: string, bytes: number, ageDays: number, mimetype: string | null = null): StoredObject =>
  ({ name, bytes, mimetype, created_at: new Date(now - ageDays * day).toISOString() });

test('every way a project can point at a file keeps that file', () => {
  const refs = referencedPaths([
    { id: 'p1', owner_id: 't1', image: { assetPath: 't1/p1/img' }, nsAudio: { assetPath: 't1/p1/gemini-a.mp3' }, anAudio: { assetPath: 't1/p1/gemini-a.mp3' } },
    { id: 'p2', owner_id: 't1', image: 'data:image/svg+xml;utf8,<svg/>', nsAudio: `${process.env.SUPABASE_URL}/storage/v1/object/sign/project-assets/t1/p2/old.wav?token=x` },
    { id: 'p3', owner_id: 't2', nsPath: 't2/p3/legacy.mp3', anAudio: 'blob:https://x/1' },
  ]);
  assert.ok(refs.has('t1/p1/img') && refs.has('t1/p1/gemini-a.mp3') && refs.has('t2/p3/legacy.mp3') && refs.has('t1/p2/old.wav'));
  assert.equal([...refs].some(r => r.startsWith('data:') || r.startsWith('blob:')), false);
});

test('unused files are removed only when a week old or already converted to MP3', () => {
  const objects = [
    obj('t1/p1/img', 300_000, 30, 'image/png'),               // referenced
    obj('t1/p1/gemini-a.mp3', 500_000, 1, 'audio/mpeg'),       // referenced
    obj('t1/p1/gemini-a.wav', 3_000_000, 1, 'audio/wav'),      // converted, unreferenced → delete
    obj('t1/p1/gemini-old.wav', 3_000_000, 10, 'audio/wav'),   // unreferenced, old → delete
    obj('t1/p1/gemini-new.wav', 3_000_000, 2, 'audio/wav'),    // unreferenced, fresh → keep (maybe not saved yet)
    obj('t1/p9/deleted-project.png', 200_000, 8, 'image/png'), // project gone, old → delete
  ];
  const rows = [{ id: 'p1', owner_id: 't1', image: { assetPath: 't1/p1/img' }, nsAudio: { assetPath: 't1/p1/gemini-a.mp3' } }];
  assert.deepEqual(orphans(objects, referencedPaths(rows), now).map(o => o.name),
    ['t1/p1/gemini-a.wav', 't1/p1/gemini-old.wav', 't1/p9/deleted-project.png']);
  const s = summarizeStorage(objects, rows, now);
  assert.equal(s.totalBytes, 10_000_000);
  assert.deepEqual(s.byKind.wav, { count: 3, bytes: 9_000_000 });
  assert.deepEqual(s.orphans, { count: 3, bytes: 6_200_000 });
  assert.ok(ORPHAN_MIN_AGE_MS >= 7 * day);
});

test('only WAV narrations a project really uses, inside its owner’s folder, are converted', () => {
  const objects = [obj('t1/p1/a.wav', 1, 1, 'audio/wav'), obj('t1/p2/b.mp3', 1, 1, 'audio/mpeg'), obj('t2/p3/c.wav', 1, 1, 'audio/wav')];
  const list = convertibleAudio([
    { id: 'p1', owner_id: 't1', nsAudio: { assetPath: 't1/p1/a.wav' }, anAudio: { assetPath: 't1/p1/a.wav' } },
    { id: 'p2', owner_id: 't1', nsAudio: { assetPath: 't1/p2/b.mp3' } },
    { id: 'p4', owner_id: 't1', nsAudio: { assetPath: 't2/p3/c.wav' } },   // someone else's file
    { id: 'p5', owner_id: 't1', nsAudio: { assetPath: 't1/p5/missing.wav' } },
  ], objects);
  assert.deepEqual(list, [{ projectId: 'p1', path: 't1/p1/a.wav' }]);
});

test('storage migration: object listing and audio replacement are server-only and keep the teacher’s timestamp', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFileSync } = await import('node:fs');
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now());
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  const file = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
  await db.exec(file('20260921_membership.sql'));
  await db.exec(file('20260930_storage_admin.sql'));
  await db.exec(file('20260930_storage_admin.sql'));
  const t1 = '00000000-0000-4000-8000-000000000021';
  await db.query(`insert into auth.users values ($1,'s@example.test',now(),'{}')`, [t1]);
  await db.query(`insert into storage.objects(bucket_id,name,metadata) values ('project-assets',$1,'{"size":3000,"mimetype":"audio/wav"}'),('other','x','{"size":1}')`, [`${t1}/p1/a.wav`]);
  const objects = (await db.query<any>(`select * from public.project_asset_objects()`)).rows;
  assert.deepEqual(objects.map(o => [o.name, Number(o.bytes), o.mimetype]), [[`${t1}/p1/a.wav`, 3000, 'audio/wav']]);

  const data = { title: 'Soru 1', narrationSource: { type: 'gemini', mimeType: 'audio/wav', fileName: 'seslendirme.wav', audioUrl: { assetPath: `${t1}/p1/a.wav` }, words: [{ text: 'x', start: 0.1, end: 0.2 }] },
    audioNarration: { mimeType: 'audio/wav', audioUrl: { assetPath: `${t1}/p1/a.wav` } } };
  await db.query(`insert into public.projects(id,owner_id,data,updated_at) values ('p1',$1,$2,'2026-09-01T00:00:00Z')`, [t1, JSON.stringify(data)]);
  const before = (await db.query<any>(`select updated_at from public.projects where id='p1'`)).rows[0].updated_at;
  assert.equal((await db.query<any>(`select public.replace_project_audio('p1',$1,$2,'audio/mpeg') as ok`, [`${t1}/p1/a.wav`, `${t1}/p1/a.mp3`])).rows[0].ok, true);
  const row = (await db.query<any>(`select data,updated_at from public.projects where id='p1'`)).rows[0];
  assert.deepEqual(row.data.narrationSource.audioUrl, { assetPath: `${t1}/p1/a.mp3` });
  assert.equal(row.data.narrationSource.mimeType, 'audio/mpeg');
  assert.equal(row.data.narrationSource.fileName, 'seslendirme.mp3');
  assert.deepEqual(row.data.narrationSource.words, data.narrationSource.words, 'timings untouched');
  assert.deepEqual(row.data.audioNarration.audioUrl, { assetPath: `${t1}/p1/a.mp3` });
  assert.equal(String(row.updated_at), String(before), 'housekeeping does not look like teacher activity');
  // Already replaced, or a path outside the owner's folder: nothing changes.
  assert.equal((await db.query<any>(`select public.replace_project_audio('p1',$1,$2,'audio/mpeg') as ok`, [`${t1}/p1/a.wav`, `${t1}/p1/a.mp3`])).rows[0].ok, false);
  assert.equal((await db.query<any>(`select public.replace_project_audio('p1',$1,'someone/else.mp3','audio/mpeg') as ok`, [`${t1}/p1/a.mp3`])).rows[0].ok, false);
  // A normal update still moves the timestamp.
  await db.query(`update public.projects set data = data || '{"title":"Soru 1b"}' where id='p1'`);
  assert.notEqual(String((await db.query<any>(`select updated_at from public.projects where id='p1'`)).rows[0].updated_at), String(before));
  await db.exec(`set role authenticated`);
  await assert.rejects(db.query(`select * from public.project_asset_objects()`), /permission denied/);
  await assert.rejects(db.query(`select public.replace_project_audio('p1','a','b','audio/mpeg')`), /permission denied/);
  await db.exec(`reset role`);
});
