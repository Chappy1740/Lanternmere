-- Battle.net account-list proof is distinct from a public character profile.
-- Existing public imports remain unverified; no user data is deleted here.
create table public.wow_character_claims (
  region text not null check (region in ('us', 'eu', 'kr', 'tw')),
  blizzard_character_id bigint not null check (blizzard_character_id > 0),
  character_id uuid not null unique references public.characters(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  realm_slug text not null,
  character_name text not null,
  claimed_at timestamptz not null default now(),
  primary key (region, blizzard_character_id),
  unique (region, realm_slug, character_name)
);

create index wow_character_claims_profile_idx on public.wow_character_claims(profile_id);
alter table public.wow_character_claims enable row level security;
revoke all on public.wow_character_claims from public, anon, authenticated;
grant all on public.wow_character_claims to service_role;
grant select on public.wow_character_claims to authenticated;
create policy wow_character_claims_owner_read on public.wow_character_claims
  for select to authenticated using (profile_id = (select auth.uid()));
create policy app_account_active on public.wow_character_claims
  as restrictive for all to authenticated
  using ((select private.app_account_active()))
  with check ((select private.app_account_active()));

-- A public-name import by another account cannot copy a claimed Traveler.
create function private.guard_claimed_wow_character() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.wow_character_claims claim
    where claim.region = new.region
      and claim.realm_slug = lower(new.realm_slug)
      and claim.character_name = lower(new.character_name)
      and claim.profile_id <> new.profile_id
  ) then
    raise exception 'This character is already claimed.' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_claimed_wow_character() from public, anon, authenticated;
create trigger guard_claimed_wow_character
  before insert or update of profile_id, region, realm_slug, character_name
  on public.characters for each row execute function private.guard_claimed_wow_character();

-- Only the server's service-role call can turn the saved, OAuth-fetched account
-- list into an exclusive claim. A fresh public profile must match the list ID.
create function public.claim_owned_wow_character(
  p_profile_id uuid,
  p_region text,
  p_profile jsonb,
  p_fetched_at timestamptz
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_region text := lower(btrim(p_region));
  v_id bigint;
  v_realm text := lower(btrim(p_profile #>> '{realm,slug}'));
  v_name text := lower(btrim(p_profile ->> 'name'));
  v_character_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'Trusted server access required.' using errcode = '42501';
  end if;
  if p_profile_id is null or coalesce(p_profile ->> 'id', '') !~ '^[0-9]+$'
    or coalesce(v_realm, '') = '' or coalesce(v_name, '') = ''
    or coalesce(p_profile ->> 'level', '') !~ '^[0-9]+$' then
    raise exception 'Invalid character claim.' using errcode = '22023';
  end if;
  v_id := (p_profile ->> 'id')::bigint;
  if v_id <= 0 or (p_profile ->> 'level')::int < 80 then
    raise exception 'Invalid character claim.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_region || ':' || v_id::text, 0));

  if not exists (
    select 1 from public.app_owned_wow_snapshots snapshot,
      lateral jsonb_array_elements(snapshot.characters) owned
    where snapshot.profile_id = p_profile_id
      and snapshot.region = v_region
      and snapshot.refreshed_at >= now() - interval '24 hours'
      and owned ->> 'id' = v_id::text
      and lower(owned #>> '{realm,slug}') = v_realm
      and lower(owned ->> 'name') = v_name
      and (owned ->> 'level') ~ '^[0-9]+$'
      and (owned ->> 'level')::int >= 80
  ) then
    raise exception 'Refresh your Battle.net character list before adding this Traveler.'
      using errcode = '42501';
  end if;

  v_character_id := public.save_verified_wow_character(
    p_profile_id, v_region, p_profile, p_fetched_at
  );

  insert into public.wow_character_claims as claim (
    region, blizzard_character_id, character_id, profile_id, realm_slug, character_name
  ) values (v_region, v_id, v_character_id, p_profile_id, v_realm, v_name)
  on conflict (region, blizzard_character_id) do update
    set claimed_at = now()
    where claim.profile_id = excluded.profile_id
      and claim.character_id = excluded.character_id
  returning character_id into v_character_id;

  if v_character_id is null then
    raise exception 'This character is already claimed by another account.' using errcode = '23505';
  end if;
  return v_character_id;
end;
$$;
revoke all on function public.claim_owned_wow_character(uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_owned_wow_character(uuid, text, jsonb, timestamptz)
  to service_role;
