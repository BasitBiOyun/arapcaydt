-- "Sorun bildir" replies: the admin writes a short answer to a report ("Sorunu çözdük hocam");
-- the teacher reads it under Mesajlar in the side menu.
-- Needs 20261003_feedback.sql first. Safe to run more than once.
alter table public.feedback add column if not exists reply text
  check (reply is null or length(reply) <= 2000);
alter table public.feedback add column if not exists replied_at timestamptz;
-- Only admins can update (feedback_resolve policy); teachers still cannot write a reply.
grant update (status, reply, replied_at) on public.feedback to authenticated;
