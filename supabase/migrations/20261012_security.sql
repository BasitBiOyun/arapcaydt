-- Small security fixes (2026-10-09). Safe to run more than once.
-- Needs 20260921_membership.sql, 20261003_feedback.sql, 20261008_feedback_reply.sql and 20261009_messages.sql first.

-- 1. The hourly limits on Mesajlar (30) and Sorun bildir (10) count rows by created_at. The
--    database now sets created_at itself, so an insert cannot backdate it to slip past the limit.
--    A report also cannot arrive with an answer already filled in (answers are only ever updates).
create or replace function public.messages_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  if not new.from_admin and (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Çok fazla mesaj gönderildi. Biraz sonra tekrar deneyin.';
  end if;
  return new;
end; $$;
revoke all on function public.messages_rate_limit() from public, anon, authenticated;

create or replace function public.feedback_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  new.reply := null;
  new.replied_at := null;
  if (select count(*) from public.feedback where owner_id = new.owner_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Çok fazla bildirim gönderildi. Biraz sonra tekrar deneyin.';
  end if;
  return new;
end; $$;
revoke all on function public.feedback_rate_limit() from public, anon, authenticated;

-- 2. A project's id becomes its folder name in file storage: no slash, backslash, space or "..".
--    NOT VALID: rows already there are not re-checked; every new or saved row is.
alter table public.projects drop constraint if exists projects_id_format;
alter table public.projects add constraint projects_id_format
  check (length(id) between 1 and 200 and id <> '.' and position('..' in id) = 0 and id !~ '[/\\[:space:]]') not valid;
