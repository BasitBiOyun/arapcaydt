begin;
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'teacher' check (role in ('teacher','admin')),
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  created_at timestamptz not null default now()
);
create function public.is_approved() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=auth.uid() and p.status='approved' and u.email_confirmed_at is not null);
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin') and public.is_approved();
$$;
create function public.sync_new_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,name) values(new.id,new.email,left(coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),120))
    on conflict(id) do update set email=excluded.email;
  -- The bootstrap address is fixed by the owner, never taken from signup metadata.
  if lower(new.email)='yunusemreyilmaz93@gmail.com' and new.email_confirmed_at is not null then
    update public.profiles set role='admin',status='approved' where id=new.id;
  end if;
  return new;
end; $$;
create trigger member_signup after insert or update of email,email_confirmed_at on auth.users
  for each row execute function public.sync_new_member();
insert into public.profiles(id,email,name,role,status)
  select id,email,coalesce(raw_user_meta_data->>'name',split_part(email,'@',1)),
    case when lower(email)='yunusemreyilmaz93@gmail.com' and email_confirmed_at is not null then 'admin' else 'teacher' end,
    case when lower(email)='yunusemreyilmaz93@gmail.com' and email_confirmed_at is not null then 'approved' else 'pending' end
  from auth.users on conflict(id) do nothing;
alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());

create table public.projects (
  id text primary key,
  owner_id uuid not null default auth.uid() references public.profiles(id),
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<2097152),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner on public.projects(owner_id,updated_at desc);
alter table public.projects enable row level security;
revoke all on public.projects from anon,authenticated;
grant select,insert,update,delete on public.projects to authenticated;
create policy project_read on public.projects for select to authenticated using(public.is_approved() and (owner_id=auth.uid() or public.is_admin()));
create policy project_insert on public.projects for insert to authenticated with check(public.is_approved() and owner_id=auth.uid());
create policy project_update on public.projects for update to authenticated using(public.is_approved() and owner_id=auth.uid()) with check(public.is_approved() and owner_id=auth.uid());
create policy project_delete on public.projects for delete to authenticated using(public.is_approved() and owner_id=auth.uid());
create function public.project_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); new.created_at=old.created_at; return new; end; $$;
create trigger project_updated before update on public.projects for each row execute function public.project_timestamp();

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles,
  project_id text references public.projects on delete set null,
  kind text not null check(kind in ('voice','video_export','member_status')),
  state text not null,
  characters integer not null default 0,
  created_at timestamptz not null default now()
);
create index activity_owner_date on public.activity(owner_id,created_at desc);
alter table public.activity enable row level security;
revoke all on public.activity from anon,authenticated;
grant select on public.activity to authenticated;
create policy activity_read on public.activity for select to authenticated using(public.is_approved() and (owner_id=auth.uid() or public.is_admin()));

create function public.set_member_status(member_id uuid, new_status text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli'; end if;
  if new_status not in ('approved','blocked','pending') then raise exception 'Geçersiz durum'; end if;
  update public.profiles set status=new_status where id=member_id and role='teacher';
  if not found then raise exception 'Öğretmen bulunamadı'; end if;
  insert into public.activity(owner_id,kind,state) values(member_id,'member_status',new_status);
end; $$;
create function public.record_video_export(project_id text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_approved() or not exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()) then raise exception 'Erişim reddedildi'; end if;
  insert into public.activity(owner_id,project_id,kind,state) values(auth.uid(),project_id,'video_export','client_reported');
end; $$;

-- Only server-side service_role can reserve paid requests. Serializes concurrent requests.
create function public.reserve_voice(member_id uuid, target_project text, char_count integer) returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
  perform pg_advisory_xact_lock(7319021);
  if char_count < 1 or char_count > 5000 then raise exception 'Metin 1–5000 karakter olmalı'; end if;
  if not exists(select 1 from public.profiles p join auth.users u on p.id=u.id where p.id=member_id and p.status='approved' and u.email_confirmed_at is not null)
    or not exists(select 1 from public.projects where id=target_project and owner_id=member_id) then raise exception 'Erişim reddedildi'; end if;
  if exists(select 1 from public.activity where owner_id=member_id and kind='voice' and created_at>now()-interval '10 seconds') then raise exception 'Yeni istek için birkaç saniye bekleyin'; end if;
  if (select coalesce(sum(characters),0) from public.activity where owner_id=member_id and kind='voice' and created_at>=date_trunc('day',now())) + char_count > 20000 then raise exception 'Günlük öğretmen ses sınırına ulaşıldı'; end if;
  insert into public.activity(owner_id,project_id,kind,state,characters) values(member_id,target_project,'voice','requested',char_count) returning id into event_id;
  return event_id;
end; $$;
revoke all on function public.reserve_voice(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_voice(uuid,text,integer) to service_role;
revoke all on function public.sync_new_member(), public.project_timestamp() from public,anon,authenticated;
revoke all on function public.is_admin(),public.is_approved(),public.set_member_status(uuid,text),public.record_video_export(text) from public,anon;
grant execute on function public.is_admin(),public.is_approved(),public.set_member_status(uuid,text),public.record_video_export(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-assets','project-assets',false,26214400,array['image/png','image/jpeg','image/webp','image/svg+xml','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/webm']);
create policy asset_read on storage.objects for select to authenticated using(bucket_id='project-assets' and public.is_approved() and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy asset_insert on storage.objects for insert to authenticated with check(bucket_id='project-assets' and public.is_approved() and (storage.foldername(name))[1]=auth.uid()::text);
create policy asset_delete on storage.objects for delete to authenticated using(bucket_id='project-assets' and public.is_approved() and (storage.foldername(name))[1]=auth.uid()::text);
create function public.admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Yönetici yetkisi gerekli'; end if;
 return jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
   select p.*, (select count(*) from public.projects q where q.owner_id=p.id) as questions,
    (select count(*) from public.projects q where q.owner_id=p.id and q.data->>'category'='deneme') as mock_questions,
    (select count(distinct nullif(trim(q.data->>'examName'),'')) from public.projects q where q.owner_id=p.id and q.data->>'category'='deneme') as mock_exams,
    (select count(*) from public.activity a where a.owner_id=p.id and a.kind='voice') as voice_attempts,
    (select count(*) from public.activity a where a.owner_id=p.id and a.kind='voice' and a.state='succeeded') as voices,
    (select coalesce(sum(characters),0) from public.activity a where a.owner_id=p.id and a.kind='voice') as characters,
    (select count(*) from public.activity a where a.owner_id=p.id and a.kind='video_export') as exports
   from public.profiles p order by p.created_at desc
 ) t),'projects',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
   select q.id,q.owner_id,q.data->>'title' title,q.data->>'category' category,q.data->>'status' status,q.updated_at
   from public.projects q order by q.updated_at desc limit 100
 ) t),'activity',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
   select * from public.activity order by created_at desc limit 100
 ) t));
end; $$;
revoke all on function public.admin_overview() from public,anon;
grant execute on function public.admin_overview() to authenticated;
grant all on public.profiles,public.projects,public.activity to service_role;
commit;
