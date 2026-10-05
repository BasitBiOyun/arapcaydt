-- Longer announcements (a "yenilikler" list does not fit in 500 characters): up to 2000.
-- Re-runnable; needs 20261001_settings.sql first.
alter table public.studio_settings drop constraint if exists studio_settings_announcement_check;
alter table public.studio_settings add constraint studio_settings_announcement_check check (length(announcement) <= 2000);
