-- Announcements can end on their own: "yayında kalma süresi" (24 saat, 3 gün, 7 gün or süresiz).
-- Re-runnable; needs 20261001_settings.sql first.
alter table public.studio_settings add column if not exists announcement_until timestamptz;

create or replace function public.studio_announcement()
returns table(announcement text, updated_at timestamptz) language sql stable security definer set search_path = '' as $$
  select s.announcement, s.updated_at from public.studio_settings s
   where public.is_approved() and s.announcement_active and length(btrim(s.announcement)) > 0
     and (s.announcement_until is null or s.announcement_until > now())
$$;
revoke all on function public.studio_announcement() from public, anon;
grant execute on function public.studio_announcement() to authenticated;
