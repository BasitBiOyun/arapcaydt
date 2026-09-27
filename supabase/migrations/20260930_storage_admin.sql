-- Storage housekeeping for the admin panel (free plan: 1 GB).
-- Safe to run more than once.

-- Every file in project-assets with its size; only the server (service role) may call it.
create or replace function public.project_asset_objects()
returns table(name text, bytes bigint, mimetype text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.metadata->>'mimetype', o.created_at
    from storage.objects o
   where o.bucket_id = 'project-assets'
   order by o.name
$$;
revoke all on function public.project_asset_objects() from public, anon, authenticated;
grant execute on function public.project_asset_objects() to service_role;

-- A housekeeping update (WAV → MP3) must not look like the teacher worked on the project.
create or replace function public.project_timestamp() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.keep_timestamp', true), '') = 'on' then new.updated_at = old.updated_at;
  else new.updated_at = now(); end if;
  new.created_at = old.created_at;
  return new;
end; $$;

-- Points a project's narration from one stored file to another (same owner folder),
-- under a row lock, only where it still references the old file.
create or replace function public.replace_project_audio(target_project text, old_path text, new_path text, new_mime text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
  owner uuid;
  k text;
  changed boolean := false;
begin
  select data, owner_id into d, owner from public.projects where id = target_project for update;
  if d is null or split_part(old_path, '/', 1) <> owner::text or split_part(new_path, '/', 1) <> owner::text then return false; end if;
  foreach k in array array['narrationSource', 'audioNarration'] loop
    if d->k->'audioUrl'->>'assetPath' = old_path then
      d := jsonb_set(d, array[k, 'audioUrl'], jsonb_build_object('assetPath', new_path));
      d := jsonb_set(d, array[k, 'mimeType'], to_jsonb(new_mime));
      if d->k ? 'fileName' and d->k->>'fileName' ~* '\.wav$' then
        d := jsonb_set(d, array[k, 'fileName'], to_jsonb(regexp_replace(d->k->>'fileName', '\.wav$', '.mp3', 'i')));
      end if;
      changed := true;
    end if;
  end loop;
  if not changed then return false; end if;
  perform set_config('app.keep_timestamp', 'on', true);
  update public.projects set data = d where id = target_project;
  perform set_config('app.keep_timestamp', '', true);
  return true;
end; $$;
revoke all on function public.replace_project_audio(text, text, text, text) from public, anon, authenticated;
grant execute on function public.replace_project_audio(text, text, text, text) to service_role;
