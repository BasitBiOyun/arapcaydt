import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPreferences, newProjectDefaults } from '../src/features/settings/preferences';
import { isMigrationPending, parseAutoApprove } from '../src/features/settings/studioSettings';

test('stored preferences keep only known, well-formed fields', () => {
  assert.deepEqual(cleanPreferences(null), {});
  assert.deepEqual(cleanPreferences(['x']), {});
  assert.deepEqual(cleanPreferences({ category: 'no-such', examName: '  ', examYear: 5, showCaptions: 'yes', captionY: 4, showOutro: false, token: 'x' }),
    { captionY: .93, showOutro: false });
  assert.deepEqual(cleanPreferences({ examName: ' Eylül Denemesi ', examYear: '2027 YDT', showCaptions: false }),
    { examName: 'Eylül Denemesi', examYear: '2027 YDT', showCaptions: false });
});

test('new questions start from the teacher’s defaults', () => {
  const d = newProjectDefaults({ examName: 'Eylül', examYear: '2027 YDT', showCaptions: false, captionY: .2, showOutro: false });
  assert.deepEqual(d, { category: undefined, examName: 'Eylül', examYear: '2027 YDT', video: { showCaptions: false, captionY: .2, showOutro: false } });
  assert.deepEqual(newProjectDefaults().video, {}, 'no preferences leave the studio defaults alone');
});

test('the auto-approval list accepts addresses and whole domains', () => {
  assert.deepEqual(parseAutoApprove('Ali@Okul.k12.tr\n@meb.gov.tr, ali@okul.k12.tr\n\nnot an address; @x'),
    { entries: ['ali@okul.k12.tr', '@meb.gov.tr'], invalid: ['not an address', '@x'] });
});

test('missing settings objects read as a pending migration, other errors do not', () => {
  assert.equal(isMigrationPending({ code: 'PGRST202', message: 'Could not find the function public.update_my_profile' }), true);
  assert.equal(isMigrationPending({ code: '42P01', message: 'relation "public.studio_settings" does not exist' }), true);
  assert.equal(isMigrationPending({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMigrationPending(null), false);
});

test('settings migration: own profile only, admin-only studio row, auto-approval and closed sign-ups', async () => {
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
  const migration = readFileSync(new URL('../supabase/migrations/20261001_settings.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);

  const admin = '00000000-0000-4000-8000-0000000000a1', teacher = '00000000-0000-4000-8000-0000000000b1';
  await db.query(`insert into auth.users values ($1,'yunusemreyilmaz93@gmail.com',now(),'{}'),($2,'t@example.test',now(),'{"name":"Ayşe"}')`, [admin, teacher]);
  await db.query(`update public.profiles set status='approved' where id=$1`, [teacher]);
  const as = async (id: string | null) => {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id || '']);
    await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
  };

  // A teacher changes only their own name and preferences, and cannot read or edit the studio row.
  await as(teacher);
  await db.query(`select public.update_my_profile('  Ayşe Hoca ', '{"examYear":"2027 YDT"}')`);
  assert.deepEqual((await db.query<any>(`select name,preferences from public.profiles where id=$1`, [teacher])).rows[0],
    { name: 'Ayşe Hoca', preferences: { examYear: '2027 YDT' } });
  await assert.rejects(db.query(`select public.update_my_profile('', '{}')`), /1–120/);
  await assert.rejects(db.query(`select public.update_my_profile('x', '[]')`), /geçersiz/);
  assert.equal((await db.query(`select * from public.studio_settings`)).rows.length, 0, 'RLS hides the row from teachers');
  await db.query(`update public.studio_settings set signups_open=false`);
  assert.equal((await db.query<any>(`select studio_signups_open() v`)).rows[0].v, true, 'the teacher update touched nothing');
  assert.deepEqual((await db.query(`select * from public.studio_announcement()`)).rows, []);
  await assert.rejects(db.query(`select public.auto_approved('x@y.z')`), /permission denied/);

  // The admin edits the studio row; approved members see the active announcement.
  await as(admin);
  await db.query(`update public.studio_settings set announcement='Cuma teslim', announcement_active=true, auto_approve='{ogretmen@okul.tr,@meb.gov.tr}', elevenlabs_align_per_teacher=5`);
  await assert.rejects(db.query(`update public.studio_settings set shared_transcribe_per_teacher=500`), /check/);
  await as(teacher);
  assert.equal((await db.query<any>(`select announcement from public.studio_announcement()`)).rows[0].announcement, 'Cuma teslim');

  // Listed addresses and domains are approved on confirmation; others wait; look-alike domains do not match.
  await db.exec(`reset role`);
  const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-0000000000c${n}`);
  await db.query(`insert into auth.users values ($1,'Ogretmen@Okul.tr',null,'{}'),($2,'ali@meb.gov.tr',now(),'{}'),($3,'x@fakemeb.gov.tr',now(),'{}'),($4,'y@meb.gov.tr.evil.com',now(),'{}')`, ids);
  const status = async (id: string) => (await db.query<any>(`select status from public.profiles where id=$1`, [id])).rows[0].status;
  assert.equal(await status(ids[0]), 'pending', 'unconfirmed addresses wait');
  await db.query(`update auth.users set email_confirmed_at=now() where id=$1`, [ids[0]]);
  assert.equal(await status(ids[0]), 'approved');
  assert.equal(await status(ids[1]), 'approved');
  assert.equal(await status(ids[2]), 'pending');
  assert.equal(await status(ids[3]), 'pending');
  await db.query(`update public.profiles set status='blocked' where id=$1`, [ids[1]]);
  await db.query(`update auth.users set email='ali2@meb.gov.tr' where id=$1`, [ids[1]]);
  assert.equal(await status(ids[1]), 'blocked', 'auto-approval never lifts a block');

  // Closed sign-ups: anon can ask, the database refuses new users, the bootstrap admin still gets in.
  await as(admin);
  await db.query(`update public.studio_settings set signups_open=false`);
  await as(null);
  assert.equal((await db.query<any>(`select public.studio_signups_open() v`)).rows[0].v, false);
  await assert.rejects(db.query(`select * from public.studio_announcement()`), /permission denied/);
  await db.exec(`reset role`);
  await assert.rejects(db.query(`insert into auth.users values (gen_random_uuid(),'new@example.test',null,'{}')`), /kapalı/);
  await db.query(`delete from auth.users where id=$1`, [admin]);
  await db.query(`insert into auth.users values ($1,'YunusEmreYilmaz93@gmail.com',now(),'{}')`, [admin]);
});
