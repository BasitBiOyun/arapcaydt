-- "Mesajlar": a one-to-one inbox between the studio admins and each teacher.
-- teacher_id names the conversation; from_admin says who wrote the message.
-- Needs 20260921_membership.sql first. Safe to run more than once.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  from_admin boolean not null default false,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_teacher on public.messages(teacher_id, created_at);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using ((teacher_id = auth.uid() and public.is_approved()) or public.is_admin());
drop policy if exists messages_write on public.messages;
create policy messages_write on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and read_at is null and (
    (from_admin and public.is_admin())
    or (not from_admin and teacher_id = auth.uid() and public.is_approved())));

-- Opening a conversation marks the other side's messages as read.
create or replace function public.mark_messages_read(conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    update public.messages set read_at = now() where teacher_id = conversation and not from_admin and read_at is null;
  end if;
  if conversation = auth.uid() and public.is_approved() then
    update public.messages set read_at = now() where teacher_id = conversation and from_admin and read_at is null;
  end if;
end; $$;
revoke all on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- At most 30 messages an hour per teacher, so a stuck button cannot flood the inbox.
create or replace function public.messages_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.from_admin and (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Çok fazla mesaj gönderildi. Biraz sonra tekrar deneyin.';
  end if;
  return new;
end; $$;
revoke all on function public.messages_rate_limit() from public, anon, authenticated;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages for each row execute function public.messages_rate_limit();
