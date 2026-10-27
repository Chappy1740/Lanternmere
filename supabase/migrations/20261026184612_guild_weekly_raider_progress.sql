-- LOCAL REVIEW ONLY. Owner approved preparation, not hosted application.
-- Structured reports reuse existing per-week Guild Vault sharing consent.
begin;
alter table public.weekly_vault_progress
  add column mythic_run_levels integer[] check (mythic_run_levels is null or (
    cardinality(mythic_run_levels) <= 100 and array_ndims(mythic_run_levels) is not distinct from 1
    and array_position(mythic_run_levels, null) is null
    and 2 <= all(mythic_run_levels) and 40 >= all(mythic_run_levels)
  ) or mythic_run_levels = '{}'::integer[]),
  add column weekly_raid_bosses integer check (weekly_raid_bosses between 0 and 1000),
  add column raid_vault_slots integer check (raid_vault_slots between 0 and 3),
  add column dungeon_vault_slots integer check (dungeon_vault_slots between 0 and 3),
  add column world_vault_slots integer check (world_vault_slots between 0 and 3),
  add column reported_at timestamptz;

-- New fields and their timestamp can only be written by the validated RPC.
revoke insert on public.weekly_vault_progress from authenticated;
grant insert (id, profile_id, character_id, reset_on, raid_progress, dungeon_progress, world_progress, notes)
  on public.weekly_vault_progress to authenticated;

create table public.guild_weekly_requirements (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  operation_id uuid references public.guild_raid_operations(id) on delete cascade,
  scope_key text generated always as (coalesce(operation_id::text, 'guild')) stored,
  region text not null check (region in ('us', 'eu')),
  reset_on date not null,
  mythic_runs_required integer not null check (mythic_runs_required between 1 and 50),
  minimum_key_level integer not null check (minimum_key_level between 2 and 40),
  raid_bosses_required integer check (raid_bosses_required between 0 and 1000),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (guild_id, scope_key, region, reset_on)
);
alter table public.guild_weekly_requirements enable row level security;
revoke all on public.guild_weekly_requirements from public, anon, authenticated;
grant select on public.guild_weekly_requirements to authenticated;
grant all on public.guild_weekly_requirements to service_role;
create policy weekly_requirements_read on public.guild_weekly_requirements
  for select to authenticated using (
    private.can_lead_guild(guild_id) or operation_id is null and private.is_guild_member(guild_id)
  );
create policy app_account_active on public.guild_weekly_requirements as restrictive
  for all to authenticated using ((select private.app_account_active()))
  with check ((select private.app_account_active()));

-- Mirrors weeklyResetForRegion; unsupported regions fail closed.
create function private.raider_progress_reset(p_region text, p_now timestamptz default now())
returns date language plpgsql stable set search_path = '' as $$
declare v_date date; v_reset timestamptz; v_weekday integer;
begin
  if p_region not in ('us', 'eu') or p_region is null then return null; end if;
  v_date := (p_now at time zone case when p_region = 'us' then 'America/Los_Angeles' else 'UTC' end)::date;
  v_weekday := case when p_region = 'us' then 2 else 3 end;
  v_date := v_date + ((v_weekday - extract(dow from v_date)::integer + 7) % 7);
  v_reset := case when p_region = 'us'
    then (v_date + time '08:00') at time zone 'America/Los_Angeles'
    else (v_date + time '04:00') at time zone 'UTC' end;
  if v_reset <= p_now then v_date := v_date + 7; end if;
  return v_date;
end $$;
revoke all on function private.raider_progress_reset(text, timestamptz) from public, anon, authenticated;

create function public.save_guild_weekly_requirement(
  p_guild_id uuid, p_operation_id uuid, p_region text, p_reset_on date,
  p_mythic_runs_required integer, p_minimum_key_level integer, p_raid_bosses_required integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null or not private.app_account_active() or not private.can_lead_guild(p_guild_id) then
    raise exception 'Verified Guild leadership required' using errcode = '42501';
  end if;
  if p_region is null or p_region not in ('us', 'eu') or p_reset_on is null
    or p_reset_on is distinct from private.raider_progress_reset(p_region)
    or p_mythic_runs_required is null or p_mythic_runs_required not between 1 and 50
    or p_minimum_key_level is null or p_minimum_key_level not between 2 and 40
    or p_raid_bosses_required not between 0 and 1000 then
    raise exception 'Check the current reset and weekly target' using errcode = '22023';
  end if;
  if p_operation_id is not null and not exists (
    select 1 from public.guild_raid_operations where id = p_operation_id and guild_id = p_guild_id
  ) then raise exception 'Raid team is not in this Guild' using errcode = '42501'; end if;
  insert into public.guild_weekly_requirements (
    guild_id, operation_id, region, reset_on, mythic_runs_required, minimum_key_level, raid_bosses_required, updated_by
  ) values (
    p_guild_id, p_operation_id, p_region, p_reset_on, p_mythic_runs_required, p_minimum_key_level, p_raid_bosses_required, v_actor
  ) on conflict (guild_id, scope_key, region, reset_on) do update set
    mythic_runs_required = excluded.mythic_runs_required,
    minimum_key_level = excluded.minimum_key_level,
    raid_bosses_required = excluded.raid_bosses_required,
    updated_by = v_actor, updated_at = now()
  returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
    values (p_guild_id, v_actor, 'guild.weekly_requirement_saved', 'guild_weekly_requirements', v_id);
  return v_id;
end $$;
revoke all on function public.save_guild_weekly_requirement(uuid, uuid, text, date, integer, integer, integer) from public, anon;
grant execute on function public.save_guild_weekly_requirement(uuid, uuid, text, date, integer, integer, integer) to authenticated;

create function public.save_weekly_raider_report(
  p_character_id uuid, p_guild_id uuid, p_reset_on date, p_mythic_run_levels integer[],
  p_weekly_raid_bosses integer, p_raid_vault_slots integer, p_dungeon_vault_slots integer,
  p_world_vault_slots integer, p_shared boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_region text; v_id uuid;
begin
  if v_actor is null or not private.app_account_active() or not private.is_guild_member(p_guild_id) then
    raise exception 'Active Guild membership required' using errcode = '42501';
  end if;
  select character.region into v_region from public.characters character
    join public.games game on game.id = character.game_id
    where character.id = p_character_id and character.profile_id = v_actor and game.slug = 'wow';
  if v_region is null then raise exception 'Character owner required' using errcode = '42501'; end if;
  if private.raider_progress_reset(v_region) is null
    or p_reset_on is null or p_reset_on is distinct from private.raider_progress_reset(v_region)
    or p_shared is null then
    raise exception 'Check the current reset and sharing choice' using errcode = '22023';
  end if;
  if p_shared and not exists (
    select 1 from public.character_guild_sharing where character_id = p_character_id and guild_id = p_guild_id
  ) then raise exception 'Share this Traveler with the Guild before sharing weekly progress' using errcode = '42501'; end if;
  insert into public.weekly_vault_progress (
    profile_id, character_id, reset_on, mythic_run_levels, weekly_raid_bosses,
    raid_vault_slots, dungeon_vault_slots, world_vault_slots, reported_at
  ) values (
    v_actor, p_character_id, p_reset_on, p_mythic_run_levels, p_weekly_raid_bosses,
    p_raid_vault_slots, p_dungeon_vault_slots, p_world_vault_slots, now()
  ) on conflict (character_id, reset_on) do update set
    mythic_run_levels = excluded.mythic_run_levels, weekly_raid_bosses = excluded.weekly_raid_bosses,
    raid_vault_slots = excluded.raid_vault_slots, dungeon_vault_slots = excluded.dungeon_vault_slots,
    world_vault_slots = excluded.world_vault_slots, reported_at = now()
    where weekly_vault_progress.profile_id = v_actor
  returning id into v_id;
  if v_id is null then raise exception 'Character owner required' using errcode = '42501'; end if;
  perform public.set_guild_vault_sharing(v_id, p_guild_id, p_shared);
  return v_id;
end $$;
revoke all on function public.save_weekly_raider_report(uuid, uuid, date, integer[], integer, integer, integer, integer, boolean) from public, anon;
grant execute on function public.save_weekly_raider_report(uuid, uuid, date, integer[], integer, integer, integer, integer, boolean) to authenticated;
commit;
