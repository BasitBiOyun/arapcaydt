-- 1) "Sorun bildir" from a question carries that question's teşhis record (words read, marks,
--    timings), so the admin can download it without the teacher sending a file.
-- 2) Server errors (5xx answers of the API) are kept for the admin panel and the morning check.
-- Needs 20261003_feedback.sql first. Safe to run more than once.
alter table public.feedback add column if not exists diagnostics jsonb
  check (diagnostics is null or octet_length(diagnostics::text) <= 800000);

create table if not exists public.server_errors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  route text not null check (length(route) <= 80),
  status integer not null,
  message text not null default '' check (length(message) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists server_errors_date on public.server_errors(created_at desc);
alter table public.server_errors enable row level security;
revoke all on public.server_errors from anon, authenticated;
grant all on public.server_errors to service_role;
