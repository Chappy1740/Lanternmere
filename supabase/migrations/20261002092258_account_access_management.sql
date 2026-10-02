-- Application access is independent of Guild/Lodge roles. No accounts start suspended.
create table public.app_account_access (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  suspended boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.app_account_activity (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create table public.app_account_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  profile_id uuid not null references public.profiles(id),
  suspended boolean not null,
  created_at timestamptz not null default now()
);
create table public.app_owned_wow_snapshots (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  region text not null check (region in ('us','eu','kr','tw')),
  characters jsonb not null check (jsonb_typeof(characters) = 'array'),
  refreshed_at timestamptz not null default now()
);
create index app_account_activity_last_seen_idx on public.app_account_activity(last_seen_at);
create index app_account_access_suspended_idx on public.app_account_access(profile_id) where suspended;
create index app_account_access_audit_actor_idx on public.app_account_access_audit(actor_id);
create index app_account_access_audit_profile_idx on public.app_account_access_audit(profile_id);
alter table public.app_account_access enable row level security;
alter table public.app_account_activity enable row level security;
alter table public.app_account_access_audit enable row level security;
alter table public.app_owned_wow_snapshots enable row level security;
revoke all on public.app_account_access, public.app_account_activity, public.app_account_access_audit, public.app_owned_wow_snapshots from anon, authenticated;
grant all on public.app_account_access, public.app_account_activity, public.app_account_access_audit, public.app_owned_wow_snapshots to service_role;
grant select on public.app_account_access, public.app_owned_wow_snapshots to authenticated;
create policy account_access_self on public.app_account_access for select to authenticated using (profile_id = (select auth.uid()));
create policy owned_wow_self on public.app_owned_wow_snapshots for select to authenticated using (profile_id = (select auth.uid()));

create function private.app_account_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.app_account_access where profile_id = auth.uid() and suspended)
$$;
revoke all on function private.app_account_active() from public, anon;
grant usage on schema private to authenticated, authenticator, service_role;
grant execute on function private.app_account_active() to authenticated;

-- PostgREST pre-request checks also cover RPCs that bypass table RLS.
create function public.check_app_account_access() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then return; end if;
  if not private.app_account_active() then
    raise sqlstate '42501' using message = 'Application access is suspended.';
  end if;
end $$;
revoke all on function public.check_app_account_access() from public;
grant execute on function public.check_app_account_access() to anon, authenticated, authenticator, service_role;
do $$ begin
  if exists (select 1 from pg_roles r, unnest(r.rolconfig) c where r.rolname='authenticator' and c like 'pgrst.db_pre_request=%') then
    raise exception 'Review the existing PostgREST pre-request hook before installing account access enforcement.';
  end if;
end $$;
alter role authenticator set pgrst.db_pre_request = 'public.check_app_account_access';
notify pgrst, 'reload config';

-- RLS covers table access, Realtime, and authenticated Storage access with old JWTs.
do $$ declare t record; begin
  for t in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relrowsecurity and c.relkind='r' and
      ((n.nspname='public' and c.relname <> 'app_account_access') or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('create policy app_account_active on %I.%I as restrictive for all to authenticated using ((select private.app_account_active())) with check ((select private.app_account_active()))',t.nspname,t.relname);
  end loop;
end $$;

create function private.record_app_activity() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.app_account_active() then raise insufficient_privilege; end if;
  insert into public.app_account_activity(profile_id) values(auth.uid())
    on conflict(profile_id) do update set last_seen_at = now()
    where app_account_activity.last_seen_at < now() - interval '5 minutes';
end $$;
revoke all on function private.record_app_activity() from public, anon;
grant execute on function private.record_app_activity() to authenticated;
create function public.record_app_activity() returns void language sql security invoker set search_path = '' as $$ select private.record_app_activity() $$;
revoke all on function public.record_app_activity() from public, anon;
grant execute on function public.record_app_activity() to authenticated;

create function public.set_app_account_access(p_actor_id uuid, p_profile_id uuid, p_suspended boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor_id = p_profile_id then raise exception 'Owner self-suspension is prohibited'; end if;
  perform 1 from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'Account not found'; end if;
  insert into public.app_account_access(profile_id,suspended) values(p_profile_id,p_suspended)
    on conflict(profile_id) do update set suspended=excluded.suspended,updated_at=now();
  insert into public.app_account_access_audit(actor_id,profile_id,suspended) values(p_actor_id,p_profile_id,p_suspended);
end $$;
revoke all on function public.set_app_account_access(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_app_account_access(uuid,uuid,boolean) to service_role;

-- Initialize optional directory sharing only at signup. Never re-enable revoked sharing.
create function private.initialize_signup_directory() returns trigger
language plpgsql security definer set search_path = '' as $$
declare metadata jsonb; nickname text;
begin
  select raw_user_meta_data into metadata from auth.users where id=new.id;
  nickname := btrim(metadata->>'display_name');
  if metadata->>'directory_opt_in'='true' and length(nickname) between 2 and 32 and nickname !~ '[[:cntrl:]@]' then
    insert into public.app_member_directory_preferences(profile_id,alias,visible_to_owner) values(new.id,nickname,true);
  end if;
  return new;
end $$;
revoke all on function private.initialize_signup_directory() from public, anon, authenticated;
create trigger initialize_signup_directory after insert on public.profiles for each row execute function private.initialize_signup_directory();
