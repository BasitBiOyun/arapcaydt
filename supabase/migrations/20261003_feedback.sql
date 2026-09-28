-- "Sorun bildir": a teacher sends what went wrong (with page, question and recent
-- errors attached) to the studio admins. Safe to run more than once.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  message text not null default '' check (length(message) <= 2000),
  context jsonb not null default '{}'::jsonb check (octet_length(context::text) <= 20000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;
grant all on public.feedback to service_role;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (owner_id = auth.uid() and public.is_approved() and status = 'open');
drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
drop policy if exists feedback_resolve on public.feedback;
create policy feedback_resolve on public.feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- At most 10 reports an hour per teacher, so a stuck button cannot flood the list.
create or replace function public.feedback_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback where owner_id = new.owner_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Çok fazla bildirim gönderildi. Biraz sonra tekrar deneyin.';
  end if;
  return new;
end; $$;
revoke all on function public.feedback_rate_limit() from public, anon, authenticated;
drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit before insert on public.feedback for each row execute function public.feedback_rate_limit();
