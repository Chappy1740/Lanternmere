-- Keep private sharing tied to current Guild membership, including departures
-- made outside the application actions. Preserve transfer history on exit.
alter table public.guild_ownership_transfers
  alter column from_member_id drop not null,
  alter column to_member_id drop not null;
alter table public.guild_ownership_transfers
  drop constraint guild_ownership_transfers_from_member_id_fkey,
  drop constraint guild_ownership_transfers_to_member_id_fkey;
alter table public.guild_ownership_transfers
  add constraint guild_ownership_transfers_from_member_id_fkey
    foreign key (from_member_id) references public.guild_members(id) on delete set null,
  add constraint guild_ownership_transfers_to_member_id_fkey
    foreign key (to_member_id) references public.guild_members(id) on delete set null;

create or replace function private.clear_guild_member_on_exit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.guild_ownership_transfers
  set canceled_at = now(), canceled_by = old.profile_id
  where guild_id = old.guild_id
    and (from_member_id = old.id or to_member_id = old.id)
    and accepted_at is null and canceled_at is null;

  delete from public.character_guild_sharing sharing
  using public.characters character
  where sharing.character_id = character.id
    and sharing.guild_id = old.guild_id
    and character.profile_id = old.profile_id;
  delete from public.guild_vault_sharing
  where guild_id = old.guild_id and profile_id = old.profile_id;
  delete from public.guild_member_availability
  where guild_id = old.guild_id and profile_id = old.profile_id;
  return old;
end;
$$;
create trigger trg_clear_guild_member_on_exit
  before delete on public.guild_members
  for each row execute function private.clear_guild_member_on_exit();
revoke all on function private.clear_guild_member_on_exit() from public, anon, authenticated;
revoke delete on public.guild_members from authenticated;
drop policy if exists "guild_members_leave_nonmaster" on public.guild_members;

drop policy "guild_member_availability_select_owner_or_leadership"
  on public.guild_member_availability;
create policy "guild_member_availability_select_owner_or_leadership"
  on public.guild_member_availability for select to authenticated
  using (private.is_guild_member(guild_id)
    and (profile_id = (select auth.uid()) or private.can_lead_guild(guild_id)));

-- All role changes must use the audited set_guild_member_role function.
revoke insert, delete on public.guild_member_roles from authenticated;
drop policy if exists "guild_member_roles_grant_nonmaster_roles" on public.guild_member_roles;
drop policy if exists "guild_member_roles_revoke_master_or_limited_officer" on public.guild_member_roles;

-- Owner-controlled sharing levels are changed atomically without granting
-- authenticated callers a general UPDATE privilege on the consent table.
create or replace function public.set_guild_character_sharing(
  p_guild_id uuid, p_character_id uuid, p_visibility text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.owns_character(p_character_id)
    or p_visibility not in ('off', 'leadership', 'members') then
    raise exception 'Invalid Guild sharing request' using errcode = '42501';
  end if;
  if p_visibility = 'off' then
    delete from public.character_guild_sharing
    where guild_id = p_guild_id and character_id = p_character_id;
  else
    if not private.is_guild_member(p_guild_id) then
      raise exception 'Guild membership required' using errcode = '42501';
    end if;
    insert into public.character_guild_sharing (guild_id, character_id, visibility)
    values (p_guild_id, p_character_id, p_visibility)
    on conflict (character_id, guild_id) do update
      set visibility = excluded.visibility;
  end if;
end;
$$;
revoke all on function public.set_guild_character_sharing(uuid, uuid, text) from public, anon;
grant execute on function public.set_guild_character_sharing(uuid, uuid, text) to authenticated;

-- A failed roster write rolls back both entries and snapshot. Only the server
-- service role may invoke this replacement after checking Guild leadership.
create or replace function public.replace_guild_official_roster(
  p_guild_id uuid, p_region text, p_realm_slug text, p_guild_name text,
  p_source_url text, p_refreshed_at timestamptz, p_members jsonb
)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_guild_id is null or p_region not in ('us', 'eu', 'kr', 'tw')
    or nullif(btrim(p_realm_slug), '') is null
    or nullif(btrim(p_guild_name), '') is null
    or p_source_url not like 'https://%'
    or p_refreshed_at is null
    or jsonb_typeof(p_members) is distinct from 'array'
    or jsonb_array_length(p_members) > 5000 then
    raise exception 'Invalid official roster' using errcode = '22023';
  end if;

  delete from public.guild_roster_entries where guild_id = p_guild_id;
  insert into public.guild_roster_entries (
    guild_id, blizzard_character_id, character_name, realm_slug,
    class_name, rank_index, source_refreshed_at
  )
  select p_guild_id, member.blizzard_character_id, member.character_name,
    member.realm_slug, member.class_name, member.rank_index, p_refreshed_at
  from jsonb_to_recordset(p_members) as member(
    blizzard_character_id bigint, character_name text, realm_slug text,
    class_name text, rank_index integer
  );
  get diagnostics v_count = row_count;
  if exists (
    select 1 from public.guild_roster_entries entry
    where entry.guild_id = p_guild_id
      and (entry.blizzard_character_id <= 0 or entry.rank_index < 0
        or btrim(entry.character_name) = '' or btrim(entry.realm_slug) = '')
  ) then
    raise exception 'Invalid official roster member' using errcode = '22023';
  end if;

  insert into public.guild_blizzard_roster_snapshots (
    guild_id, region, realm_slug, guild_name, source_url,
    refreshed_at, failure_message
  ) values (
    p_guild_id, p_region, p_realm_slug, p_guild_name, p_source_url,
    p_refreshed_at, null
  ) on conflict (guild_id) do update set
    region = excluded.region,
    realm_slug = excluded.realm_slug,
    guild_name = excluded.guild_name,
    source_url = excluded.source_url,
    refreshed_at = excluded.refreshed_at,
    failure_message = null;
  return v_count;
end;
$$;
revoke all on function public.replace_guild_official_roster(uuid, text, text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_guild_official_roster(uuid, text, text, text, text, timestamptz, jsonb)
  to service_role;

-- Event creation alone does not authorize a former Lodge member to publish it.
create or replace function public.create_guild_raid_operation(p_guild_id uuid, p_event_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_operation_id uuid;
begin
  if v_actor is null or not private.can_lead_guild(p_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.events event
    where event.id = p_event_id
      and private.is_lodge_member(event.lodge_id)
      and (event.created_by = v_actor or private.is_lodge_admin(event.lodge_id))
  ) then
    raise exception 'Current Lodge creator or administrator access required' using errcode = '42501';
  end if;
  insert into public.guild_raid_operations (guild_id, event_id, authorized_by)
  values (p_guild_id, p_event_id, v_actor)
  returning id into v_operation_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (p_guild_id, v_actor, 'guild.raid_operation_authorized', 'guild_raid_operations', v_operation_id,
    jsonb_build_object('event_id', p_event_id));
  return v_operation_id;
end;
$$;
