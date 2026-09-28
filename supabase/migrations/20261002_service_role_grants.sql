-- The server (Vercel, SUPABASE_SERVICE_ROLE_KEY) reads and writes these tables.
-- This project does not grant table rights to service_role automatically, and the
-- teacher key and studio settings migrations forgot to. Safe to run more than once;
-- tables that do not exist yet are skipped.
do $$
declare t text;
begin
  foreach t in array array['teacher_gemini_keys','studio_settings','profiles','projects','activity'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant all on public.%I to service_role', t);
    end if;
  end loop;
end $$;
