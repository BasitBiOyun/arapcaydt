import test from 'node:test';
import assert from 'node:assert/strict';

test('messages migration: each teacher sees only their conversation, only admins write as admin, read marks', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFileSync } = await import('node:fs');
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20260921_membership.sql', import.meta.url), 'utf8'));
  const migration = readFileSync(new URL('../supabase/migrations/20261009_messages.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  const admin = '00000000-0000-4000-8000-0000000000a1', t1 = '00000000-0000-4000-8000-0000000000b1', t2 = '00000000-0000-4000-8000-0000000000b2', t3 = '00000000-0000-4000-8000-0000000000b3';
  await db.query(`insert into auth.users values ($1,'yunusemreyilmaz93@gmail.com',now(),'{}'),($2,'t1@x.tr',now(),'{}'),($3,'t2@x.tr',now(),'{}'),($4,'t3@x.tr',now(),'{}')`, [admin, t1, t2, t3]);
  await db.query(`update public.profiles set status='approved' where id in ($1,$2)`, [t1, t2]);
  const as = async (id: string) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]); await db.exec('set role authenticated'); };

  await as(admin);
  await db.query(`insert into public.messages(teacher_id, from_admin, body) values ($1, true, 'Merhaba hocam')`, [t1]);
  await as(t1);
  await db.query(`insert into public.messages(teacher_id, body) values ($1, 'Teşekkürler')`, [t1]);
  await assert.rejects(db.query(`insert into public.messages(teacher_id, from_admin, body) values ($1, true, 'yönetici gibi')`, [t1]), /row-level security/);
  await assert.rejects(db.query(`insert into public.messages(teacher_id, body) values ($1, 'başkasına')`, [t2]), /row-level security/);
  await assert.rejects(db.query(`insert into public.messages(teacher_id, body) values ($1, '   ')`, [t1]), /check/);
  assert.equal((await db.query<any>(`select count(*)::int n from public.messages where from_admin and read_at is null`)).rows[0].n, 1);
  await db.query(`select public.mark_messages_read($1)`, [t1]);
  assert.equal((await db.query<any>(`select count(*)::int n from public.messages where from_admin and read_at is null`)).rows[0].n, 0, 'the teacher read the admin message');
  assert.equal((await db.query<any>(`select count(*)::int n from public.messages where not from_admin and read_at is null`)).rows[0].n, 1, 'their own message stays unread for the admin');
  await assert.rejects(db.query(`update public.messages set body='x'`), /permission denied/);
  await as(t2);
  assert.equal((await db.query(`select * from public.messages`)).rows.length, 0, 'other teachers see nothing');
  await db.query(`select public.mark_messages_read($1)`, [t1]);
  await as(t3);
  await assert.rejects(db.query(`insert into public.messages(teacher_id, body) values ($1, 'onaysız')`, [t3]), /row-level security/);
  await as(admin);
  assert.equal((await db.query(`select * from public.messages`)).rows.length, 2, 'the admin sees every conversation');
  await db.query(`select public.mark_messages_read($1)`, [t1]);
  assert.equal((await db.query<any>(`select count(*)::int n from public.messages where read_at is null`)).rows[0].n, 0);

  await as(t2);
  for (let i = 0; i < 30; i++) await db.query(`insert into public.messages(teacher_id, body) values ($1, 'tekrar')`, [t2]);
  await assert.rejects(db.query(`insert into public.messages(teacher_id, body) values ($1, 'bir daha')`, [t2]), /Çok fazla mesaj/);
  await db.exec('reset role');
});
