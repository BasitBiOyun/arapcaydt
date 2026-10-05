-- "Telaffuz sözlüğü": one shared list of how words are to be read aloud. Only the text sent
-- to the voice changes; the solution text on screen and in the video stays as written.
-- Every approved teacher may read and add entries, and change or delete their own; admins any.
-- Needs 20260921_membership.sql first. Safe to run more than once.
create table if not exists public.pronunciations (
  id uuid primary key default gen_random_uuid(),
  written text not null check (length(btrim(written)) between 1 and 60),
  spoken text not null check (length(btrim(spoken)) between 1 and 120),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists pronunciations_written on public.pronunciations(lower(btrim(written)));
alter table public.pronunciations enable row level security;
revoke all on public.pronunciations from anon, authenticated;
grant select, insert, update, delete on public.pronunciations to authenticated;
grant all on public.pronunciations to service_role;

drop policy if exists pronunciations_read on public.pronunciations;
create policy pronunciations_read on public.pronunciations for select to authenticated using (public.is_approved());
drop policy if exists pronunciations_add on public.pronunciations;
create policy pronunciations_add on public.pronunciations for insert to authenticated
  with check (public.is_approved() and created_by = auth.uid());
drop policy if exists pronunciations_change on public.pronunciations;
create policy pronunciations_change on public.pronunciations for update to authenticated
  using (public.is_approved() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_approved() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists pronunciations_remove on public.pronunciations;
create policy pronunciations_remove on public.pronunciations for delete to authenticated
  using (public.is_approved() and (created_by = auth.uid() or public.is_admin()));
