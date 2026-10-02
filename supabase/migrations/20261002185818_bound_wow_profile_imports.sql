-- A failed public-profile request still consumes an upstream call. Claim a short
-- window before fetching so repeated failures cannot hammer Blizzard.
create table public.wow_profile_fetch_limits (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  region text not null check (region in ('us', 'eu', 'kr', 'tw')),
  realm_slug text not null check (length(realm_slug) between 1 and 100),
  character_name text not null check (length(character_name) between 1 and 40),
  attempted_at timestamptz not null default now(),
  primary key (profile_id, region, realm_slug, character_name)
);
alter table public.wow_profile_fetch_limits enable row level security;
revoke all on public.wow_profile_fetch_limits from public, anon, authenticated;
grant select, insert, update, delete on public.wow_profile_fetch_limits to service_role;

create function public.claim_wow_profile_fetch(
  p_profile_id uuid, p_region text, p_realm_slug text, p_character_name text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_claimed boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'Trusted server access required.' using errcode = '42501';
  end if;
  if p_profile_id is null or p_region is null or p_region not in ('us', 'eu', 'kr', 'tw')
    or p_realm_slug is null or length(p_realm_slug) not between 1 and 100
    or p_character_name is null or length(p_character_name) not between 1 and 40 then
    raise exception 'Invalid character lookup.' using errcode = '22023';
  end if;
  delete from public.wow_profile_fetch_limits
  where profile_id = p_profile_id and attempted_at < now() - interval '1 day';
  insert into public.wow_profile_fetch_limits
    (profile_id, region, realm_slug, character_name, attempted_at)
  values (p_profile_id, p_region, p_realm_slug, p_character_name, now())
  on conflict (profile_id, region, realm_slug, character_name)
  do update set attempted_at = excluded.attempted_at
  where wow_profile_fetch_limits.attempted_at <= excluded.attempted_at - interval '5 minutes'
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;
revoke all on function public.claim_wow_profile_fetch(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_wow_profile_fetch(uuid, text, text, text)
  to service_role;

-- Retain a useful recent history without letting every import append forever.
create function private.retain_recent_wow_character_snapshots()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'blizzard' then
    delete from public.character_snapshots snapshot
    where snapshot.id in (
      select id from public.character_snapshots
      where character_id = new.character_id and source = 'blizzard'
      order by last_refreshed_at desc, created_at desc, id desc
      offset 10
    );
  end if;
  return new;
end;
$$;
revoke all on function private.retain_recent_wow_character_snapshots()
  from public, anon, authenticated;
create trigger trg_retain_recent_wow_character_snapshots
  after insert on public.character_snapshots
  for each row execute function private.retain_recent_wow_character_snapshots();
