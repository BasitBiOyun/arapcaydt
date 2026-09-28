-- Settings for teachers (profile, defaults) and the studio (announcement,
-- daily limits, auto-approval, sign-ups). Safe to run more than once.

-- Teacher's own preferences: new-question and video defaults.
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Teachers may change only their own name and preferences (profiles has no UPDATE grant).
create or replace function public.update_my_profile(new_name text, new_preferences jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved() then raise exception 'Erişim reddedildi'; end if;
  if new_name is null or length(btrim(new_name)) not between 1 and 120 then raise exception 'Ad 1–120 karakter olmalı'; end if;
  if new_preferences is null or jsonb_typeof(new_preferences) <> 'object' or octet_length(new_preferences::text) > 4000 then
    raise exception 'Tercihler geçersiz';
  end if;
  update public.profiles set name = btrim(new_name), preferences = new_preferences where id = auth.uid();
end; $$;
revoke all on function public.update_my_profile(text, jsonb) from public, anon;
grant execute on function public.update_my_profile(text, jsonb) to authenticated;

-- One row of studio-wide settings, edited by admins.
create table if not exists public.studio_settings (
  id boolean primary key default true check (id),
  announcement text not null default '' check (length(announcement) <= 500),
  announcement_active boolean not null default false,
  shared_transcribe_per_teacher integer not null default 25 check (shared_transcribe_per_teacher between 0 and 100),
  elevenlabs_align_per_teacher integer not null default 20 check (elevenlabs_align_per_teacher between 0 and 200),
  auto_approve text[] not null default '{}',
  signups_open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.studio_settings (id) values (true) on conflict (id) do nothing;
alter table public.studio_settings enable row level security;
revoke all on public.studio_settings from anon, authenticated;
grant select, update on public.studio_settings to authenticated;
grant all on public.studio_settings to service_role;
drop policy if exists studio_settings_admin_read on public.studio_settings;
create policy studio_settings_admin_read on public.studio_settings for select to authenticated using (public.is_admin());
drop policy if exists studio_settings_admin_write on public.studio_settings;
create policy studio_settings_admin_write on public.studio_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- What every approved member may see (the auto-approval list stays admin-only).
create or replace function public.studio_announcement()
returns table(announcement text, updated_at timestamptz) language sql stable security definer set search_path = '' as $$
  select s.announcement, s.updated_at from public.studio_settings s
   where public.is_approved() and s.announcement_active and length(btrim(s.announcement)) > 0
$$;
revoke all on function public.studio_announcement() from public, anon;
grant execute on function public.studio_announcement() to authenticated;

-- The landing page asks this before offering "Hesap oluştur".
create or replace function public.studio_signups_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select signups_open from public.studio_settings where id), true)
$$;
revoke all on function public.studio_signups_open() from public;
grant execute on function public.studio_signups_open() to anon, authenticated;

-- Closed sign-ups are enforced by the database, not only hidden in the page.
create or replace function public.guard_signups() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.studio_signups_open() and lower(new.email) <> 'yunusemreyilmaz93@gmail.com' then
    raise exception 'Yeni kayıtlar şu an kapalı';
  end if;
  return new;
end; $$;
revoke all on function public.guard_signups() from public, anon, authenticated;
drop trigger if exists member_signup_guard on auth.users;
create trigger member_signup_guard before insert on auth.users for each row execute function public.guard_signups();

-- Whether an address is on the auto-approval list ("ad@okul.tr" or a whole domain "@meb.k12.tr").
create or replace function public.auto_approved(address text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.studio_settings s, unnest(s.auto_approve) entry
     where s.id and (
       lower(btrim(entry)) = lower(address)
       or (left(btrim(entry), 1) = '@' and length(btrim(entry)) > 1 and right(lower(address), length(btrim(entry))) = lower(btrim(entry)))
     )
  )
$$;
revoke all on function public.auto_approved(text) from public, anon, authenticated;

-- Same as the membership migration, plus: a confirmed address on the list is approved at once.
create or replace function public.sync_new_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,name) values(new.id,new.email,left(coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),120))
    on conflict(id) do update set email=excluded.email;
  -- The bootstrap address is fixed by the owner, never taken from signup metadata.
  if lower(new.email)='yunusemreyilmaz93@gmail.com' and new.email_confirmed_at is not null then
    update public.profiles set role='admin',status='approved' where id=new.id;
  elsif new.email_confirmed_at is not null and public.auto_approved(new.email) then
    update public.profiles set status='approved' where id=new.id and status='pending';
  end if;
  return new;
end; $$;
