-- Existing Guild workspaces remain intact, but their self-assigned roles are
-- not authority until a Battle.net-owned rank-zero character claims the Guild.
create table public.guild_verified_claims (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  blizzard_character_id bigint not null,
  region text not null check (region in ('us', 'eu', 'kr', 'tw')),
  realm_slug text not null,
  guild_name text not null,
  claimed_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index idx_guild_verified_claims_profile on public.guild_verified_claims(profile_id);
alter table public.guild_verified_claims enable row level security;
revoke all on public.guild_verified_claims from anon, authenticated;
grant select on public.guild_verified_claims to authenticated;
create policy "guild_verified_claims_select_member" on public.guild_verified_claims
  for select to authenticated using (private.is_guild_member(guild_id));

create or replace function private.has_guild_role(p_guild_id uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.guild_members member
    join public.guild_member_roles member_role on member_role.guild_member_id = member.id
    join public.guild_verified_claims claim on claim.guild_id = member.guild_id
    where member.guild_id = p_guild_id
      and member.profile_id = (select auth.uid())
      and member_role.role = p_role
      and claim.expires_at > now()
      and (
        (p_role = 'guild_master' and claim.profile_id = member.profile_id)
        or (p_role <> 'guild_master' and member_role.granted_at >= claim.claimed_at)
      )
  );
$$;

-- New workspaces are pending claims, never self-declared in-game Guilds.
create or replace function public.create_guild(p_name text, p_description text default null)
returns public.guilds language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_base text;
  v_slug text;
  v_guild public.guilds;
  v_attempt int := 0;
begin
  if v_actor is null then
    raise exception 'create_guild: authentication required' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 60 then
    raise exception 'create_guild: Guild name must be between 1 and 60 characters' using errcode = '22023';
  end if;
  v_base := private.slugify(btrim(p_name));
  if v_base = '' then v_base := 'guild'; end if;
  v_slug := v_base;
  loop
    begin
      insert into public.guilds (name, slug, description, created_by)
      values (btrim(p_name), v_slug, nullif(btrim(coalesce(p_description, '')), ''), v_actor)
      returning * into v_guild;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise exception 'create_guild: could not generate a unique slug' using errcode = '23505';
      end if;
      v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    end;
  end loop;
  insert into public.guild_members (guild_id, profile_id) values (v_guild.id, v_actor);
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (v_guild.id, v_actor, 'guild.workspace_created_pending_verification', 'guilds', v_guild.id);
  return v_guild;
end;
$$;

-- Only the server's service-role client calls this after checking both the
-- consented Account Profile and a fresh official rank-zero roster entry.
create or replace function public.claim_verified_guild_master(
  p_guild_id uuid, p_profile_id uuid, p_character_id bigint,
  p_region text, p_realm_slug text, p_guild_name text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member_id uuid;
  v_prior_profile_id uuid;
  v_claimed_at timestamptz;
begin
  if p_guild_id is null or p_profile_id is null or p_character_id is null
     or p_region not in ('us', 'eu', 'kr', 'tw')
     or length(btrim(coalesce(p_realm_slug, ''))) = 0
     or length(btrim(coalesce(p_guild_name, ''))) = 0 then
    raise exception 'Invalid verified Guild claim' using errcode = '22023';
  end if;
  perform 1 from public.guilds where id = p_guild_id for update;
  if not found then raise exception 'Guild not found' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.guild_blizzard_roster_snapshots snapshot
    where snapshot.guild_id = p_guild_id
      and snapshot.region = p_region
      and snapshot.realm_slug = p_realm_slug
      and snapshot.guild_name = p_guild_name
  ) then
    raise exception 'Guild roster identity changed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Claimant not found' using errcode = '22023';
  end if;
  select profile_id, claimed_at into v_prior_profile_id, v_claimed_at
  from public.guild_verified_claims where guild_id = p_guild_id;
  if v_prior_profile_id is distinct from p_profile_id then
    -- Any legacy, self-declared or formerly delegated roles are no longer authority.
    delete from public.guild_member_roles role using public.guild_members member
    where role.guild_member_id = member.id and member.guild_id = p_guild_id;
    update public.guild_ownership_transfers set canceled_at = now(), canceled_by = p_profile_id
    where guild_id = p_guild_id and accepted_at is null and canceled_at is null;
    v_claimed_at := now();
  end if;
  insert into public.guild_members (guild_id, profile_id)
  values (p_guild_id, p_profile_id)
  on conflict (guild_id, profile_id) do update set profile_id = excluded.profile_id
  returning id into v_member_id;
  insert into public.guild_verified_claims (
    guild_id, profile_id, blizzard_character_id, region, realm_slug,
    guild_name, claimed_at, last_verified_at, expires_at
  ) values (
    p_guild_id, p_profile_id, p_character_id, p_region, p_realm_slug,
    p_guild_name, v_claimed_at, now(), now() + interval '7 days'
  ) on conflict (guild_id) do update set
    profile_id = excluded.profile_id,
    blizzard_character_id = excluded.blizzard_character_id,
    region = excluded.region,
    realm_slug = excluded.realm_slug,
    guild_name = excluded.guild_name,
    claimed_at = excluded.claimed_at,
    last_verified_at = excluded.last_verified_at,
    expires_at = excluded.expires_at;
  insert into public.guild_member_roles (guild_member_id, role, granted_by)
  values (v_member_id, 'guild_master', p_profile_id) on conflict do nothing;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id,
    metadata)
  values (p_guild_id, p_profile_id, 'guild.master_verified_by_blizzard',
    'guild_verified_claims', p_guild_id,
    jsonb_build_object('character_id', p_character_id, 'region', p_region,
      'realm_slug', p_realm_slug, 'replaced_claim', v_prior_profile_id is not null
        and v_prior_profile_id is distinct from p_profile_id));
end;
$$;
revoke all on function public.claim_verified_guild_master(uuid, uuid, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_verified_guild_master(uuid, uuid, bigint, text, text, text)
  to service_role;

-- An in-app transfer must never overwrite Blizzard's rank-zero authority.
revoke execute on function public.request_guild_ownership_transfer(uuid)
  from public, anon, authenticated;
revoke execute on function public.cancel_guild_ownership_transfer(uuid)
  from public, anon, authenticated;
revoke execute on function public.accept_guild_ownership_transfer(uuid)
  from public, anon, authenticated;
