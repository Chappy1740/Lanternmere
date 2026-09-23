-- Raid Room encounter workspaces belong only to an authorized Guild operation.
-- Visibility is explicit even though this first surface is leadership-only.
create table public.guild_raid_encounters (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.guild_raid_operations(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  encounter_order integer not null default 0 check (encounter_order between 0 and 1000),
  strategy text not null default '' check (length(strategy) <= 6000),
  visibility text not null default 'leadership' check (visibility in ('leadership')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guild_raid_encounters_operation
  on public.guild_raid_encounters(operation_id, encounter_order, created_at);

create trigger trg_guild_raid_encounters_updated_at
  before update on public.guild_raid_encounters
  for each row execute function private.set_updated_at();

create table public.guild_raid_encounter_directives (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.guild_raid_encounters(id) on delete cascade,
  directive_type text not null check (directive_type in ('assignment', 'interrupt', 'cooldown', 'marker', 'note')),
  title text not null check (length(btrim(title)) between 1 and 160),
  details text not null default '' check (length(details) <= 2000),
  assigned_guild_member_id uuid references public.guild_members(id) on delete set null,
  directive_order integer not null default 0 check (directive_order between 0 and 1000),
  visibility text not null default 'leadership' check (visibility in ('leadership')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guild_raid_encounter_directives_encounter
  on public.guild_raid_encounter_directives(encounter_id, directive_order, created_at);

create trigger trg_guild_raid_encounter_directives_updated_at
  before update on public.guild_raid_encounter_directives
  for each row execute function private.set_updated_at();

create or replace function private.can_manage_guild_raid_encounter(p_encounter_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.guild_raid_encounters encounter
    where encounter.id = p_encounter_id
      and private.can_manage_guild_raid_operation(encounter.operation_id)
  );
$$;

create or replace function public.create_guild_raid_encounter(
  p_operation_id uuid, p_title text, p_encounter_order integer default 0, p_strategy text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 or length(p_title) > 160
    or p_encounter_order is null or p_encounter_order < 0 or p_encounter_order > 1000
    or p_strategy is null or length(p_strategy) > 6000 then
    raise exception 'Invalid encounter workspace' using errcode = '22023';
  end if;
  insert into public.guild_raid_encounters (operation_id, title, encounter_order, strategy, created_by, updated_by)
  values (p_operation_id, btrim(p_title), p_encounter_order, p_strategy, v_actor, v_actor)
  returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.raid_encounter_created', 'guild_raid_encounters', v_id,
    jsonb_build_object('operation_id', p_operation_id, 'visibility', 'leadership'));
  return v_id;
end;
$$;

create or replace function public.set_guild_raid_encounter_strategy(p_encounter_id uuid, p_strategy text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select operation.guild_id into v_guild_id
  from public.guild_raid_encounters encounter
  join public.guild_raid_operations operation on operation.id = encounter.operation_id
  where encounter.id = p_encounter_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  if p_strategy is null or length(p_strategy) > 6000 then
    raise exception 'Invalid encounter strategy' using errcode = '22023';
  end if;
  update public.guild_raid_encounters set strategy = p_strategy, updated_by = v_actor where id = p_encounter_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.raid_encounter_strategy_updated', 'guild_raid_encounters', p_encounter_id);
end;
$$;

create or replace function public.create_guild_raid_encounter_directive(
  p_encounter_id uuid, p_directive_type text, p_title text, p_details text default '',
  p_assigned_guild_member_id uuid default null, p_directive_order integer default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
  select operation.guild_id into v_guild_id
  from public.guild_raid_encounters encounter
  join public.guild_raid_operations operation on operation.id = encounter.operation_id
  where encounter.id = p_encounter_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  if p_directive_type not in ('assignment', 'interrupt', 'cooldown', 'marker', 'note')
    or p_title is null or length(btrim(p_title)) = 0 or length(p_title) > 160
    or p_details is null or length(p_details) > 2000
    or p_directive_order is null or p_directive_order < 0 or p_directive_order > 1000 then
    raise exception 'Invalid encounter directive' using errcode = '22023';
  end if;
  if p_assigned_guild_member_id is not null and not exists (
    select 1 from public.guild_members where id = p_assigned_guild_member_id and guild_id = v_guild_id
  ) then
    raise exception 'Guild member is unavailable' using errcode = '42501';
  end if;
  insert into public.guild_raid_encounter_directives (
    encounter_id, directive_type, title, details, assigned_guild_member_id, directive_order, created_by
  ) values (
    p_encounter_id, p_directive_type, btrim(p_title), p_details, p_assigned_guild_member_id, p_directive_order, v_actor
  ) returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.raid_encounter_directive_created', 'guild_raid_encounter_directives', v_id,
    jsonb_build_object('encounter_id', p_encounter_id, 'directive_type', p_directive_type, 'visibility', 'leadership'));
  return v_id;
end;
$$;

alter table public.guild_raid_encounters enable row level security;
alter table public.guild_raid_encounter_directives enable row level security;
revoke all on public.guild_raid_encounters, public.guild_raid_encounter_directives from anon, authenticated;
grant select on public.guild_raid_encounters, public.guild_raid_encounter_directives to authenticated;
create policy "guild_raid_encounters_select_leadership" on public.guild_raid_encounters for select to authenticated
  using (private.can_manage_guild_raid_operation(operation_id));
create policy "guild_raid_encounter_directives_select_leadership" on public.guild_raid_encounter_directives for select to authenticated
  using (private.can_manage_guild_raid_encounter(encounter_id));

revoke all on function public.create_guild_raid_encounter(uuid, text, integer, text), public.set_guild_raid_encounter_strategy(uuid, text), public.create_guild_raid_encounter_directive(uuid, text, text, text, uuid, integer) from public, anon;
grant execute on function public.create_guild_raid_encounter(uuid, text, integer, text), public.set_guild_raid_encounter_strategy(uuid, text), public.create_guild_raid_encounter_directive(uuid, text, text, text, uuid, integer) to authenticated;
