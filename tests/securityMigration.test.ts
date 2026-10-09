import test from 'node:test';
import assert from 'node:assert/strict';
import { isProjectId } from '../server/projectAudio';

test('security migration: rate limits cannot be dodged by backdating, reports cannot carry a reply, ids stay folder-safe', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFileSync } = await import('node:fs');
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  for (const file of ['20260921_membership.sql', '20261003_feedback.sql', '20261008_feedback_reply.sql', '20261009_messages.sql'])
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  const admin = '00000000-0000-4000-8000-0000000000a1', t1 = '00000000-0000-4000-8000-0000000000b1';
  await db.query(`insert into auth.users values ($1,'yunusemreyilmaz93@gmail.com',now(),'{}'),($2,'t1@x.tr',now(),'{}')`, [admin, t1]);
  await db.query(`insert into public.projects(id, owner_id, data) values ('eski.proje', $1, '{}')`, [t1]);
  const migration = readFileSync(new URL('../supabase/migrations/20261012_security.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  await db.query(`update public.profiles set status='approved' where id = $1`, [t1]);
  const as = async (id: string) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]); await db.exec('set role authenticated'); };

  await as(t1);
  for (let i = 0; i < 10; i++) await db.query(`insert into public.feedback(message, created_at) values ('eski', now() - interval '3 hours')`);
  await assert.rejects(db.query(`insert into public.feedback(message, created_at) values ('bir daha', now() - interval '3 hours')`), /Çok fazla bildirim/);
  for (let i = 0; i < 30; i++) await db.query(`insert into public.messages(teacher_id, body, created_at) values ($1, 'x', now() - interval '2 hours')`, [t1]);
  await assert.rejects(db.query(`insert into public.messages(teacher_id, body, created_at) values ($1, 'x', now() - interval '2 hours')`, [t1]), /Çok fazla mesaj/);

  await db.exec('reset role');
  await db.query(`delete from public.feedback`);
  await as(t1);
  await db.query(`insert into public.feedback(message, reply, replied_at) values ('soru', 'Sorunu çözdüm hocam', now())`);
  await db.exec('reset role');
  assert.deepEqual((await db.query<any>(`select reply, replied_at from public.feedback`)).rows, [{ reply: null, replied_at: null }]);

  await as(t1);
  await db.query(`insert into public.projects(id, data) values ('3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90', '{}'), ('legacy_x_17.5', '{}')`);
  for (const bad of ['../başka/proje', 'a/b', 'iki kelime'])
    await assert.rejects(db.query(`insert into public.projects(id, data) values ($1, '{}')`, [bad]), /projects_id_format/);
  await db.exec('reset role');
  assert.equal((await db.query<any>(`select count(*)::int n from public.projects where id = 'eski.proje'`)).rows[0].n, 1, 'older rows stay');

  for (const id of ['3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90', 'legacy_x_17.5', 'p1']) assert.equal(isProjectId(id), true, id);
  for (const id of ['', '.', '../t2/p', 'a/b', 'a\\b', 'a b', 'x'.repeat(201)]) assert.equal(isProjectId(id), false, id);
});
