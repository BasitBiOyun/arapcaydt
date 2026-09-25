begin;

-- Allow administrators to record role changes separately from access-status changes.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity
  add constraint activity_kind_check
  check(kind in ('voice','video_export','member_status','member_role'));

create or replace function public.set_member_role(member_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_email text;
begin
  if not public.is_admin() then
    raise exception 'Yönetici yetkisi gerekli';
  end if;

  if new_role not in ('teacher','admin') then
    raise exception 'Geçersiz rol';
  end if;

  select lower(u.email)
    into target_email
    from public.profiles p
    join auth.users u on u.id=p.id
   where p.id=member_id;

  if target_email is null then
    raise exception 'Üye bulunamadı';
  end if;

  if new_role='admin' then
    if not exists(
      select 1 from auth.users u
       where u.id=member_id and u.email_confirmed_at is not null
    ) then
      raise exception 'Yönetici yapılmadan önce e-posta doğrulanmalıdır';
    end if;

    update public.profiles
       set role='admin', status='approved'
     where id=member_id;
  else
    if target_email='yunusemreyilmaz93@gmail.com' then
      raise exception 'Ana yönetici öğretmene dönüştürülemez';
    end if;
    if member_id=auth.uid() then
      raise exception 'Kendi yönetici rolünüzü kaldıramazsınız';
    end if;

    update public.profiles
       set role='teacher'
     where id=member_id;
  end if;

  insert into public.activity(owner_id,kind,state)
  values(member_id,'member_role',new_role);
end;
$$;

revoke all on function public.set_member_role(uuid,text) from public,anon;
grant execute on function public.set_member_role(uuid,text) to authenticated;

commit;
