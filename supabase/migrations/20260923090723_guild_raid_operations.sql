-- Guild raid operations are an operational layer over an explicitly authorized
-- canonical Quest Board event. They never copy event or RSVP records.
create table public.guild_raid_operations (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  authorized_by uuid not null references public.profiles(id),
  authorized_at timestamptz not null default now(),
  operational_notes text not null default '' check (length(operational_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, event_id)
);

create index idx_guild_raid_operations_guild on public.guild_raid_operations(guild_id, created_at desc);
create index idx_guild_raid_operations_event on public.guild_raid_operations(event_id);

create trigger trg_guild_raid_operations_updated_at
  before update on public.guild_raid_operations
  for each row execute function private.set_updated_at();

create table public.guild_raid_operation_members (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.guild_raid_operations(id) on delete cascade,
  guild_member_id uuid not null references public.guild_members(id) on delete cascade,
  planning_status text not null check (planning_status in ('selected', 'bench')),
  raid_role text not null check (raid_role in ('tank', 'healer', 'dps')),
  planned_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (operation_id, guild_member_id)
);

create index idx_guild_raid_operation_members_operation on public.guild_raid_operation_members(operation_id);

create trigger trg_guild_raid_operation_members_updated_at
  before update on public.guild_raid_operation_members
  for each row execute function private.set_updated_at();

create table public.guild_raid_assignments (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.guild_raid_operations(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  details text not null default '' check (length(details) <= 2000),
  assigned_guild_member_id uuid references public.guild_members(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guild_raid_assignments_operation on public.guild_raid_assignments(operation_id, created_at);

create trigger trg_guild_raid_assignments_updated_at
  before update on public.guild_raid_assignments
  for each row execute function private.set_updated_at();

create or replace function private.can_manage_guild_raid_operation(p_operation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guild_raid_operations operation
    where operation.id = p_operation_id and private.can_lead_guild(operation.guild_id)
  );
$$;

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
      and (event.created_by = v_actor or private.is_lodge_admin(event.lodge_id))
  ) then
    raise exception 'Only an event creator or Lodge administrator may authorize this Guild operation' using errcode = '42501';
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

create or replace function public.set_guild_raid_operation_notes(p_operation_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then raise exception 'Guild leadership required' using errcode = '42501'; end if;
  if p_notes is null or length(p_notes) > 4000 then raise exception 'Invalid operational notes' using errcode = '22023'; end if;
  update public.guild_raid_operations set operational_notes = p_notes where id = p_operation_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.raid_operation_notes_updated', 'guild_raid_operations', p_operation_id);
end;
$$;

create or replace function public.set_guild_raid_operation_member(
  p_operation_id uuid, p_guild_member_id uuid, p_planning_status text, p_raid_role text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then raise exception 'Guild leadership required' using errcode = '42501'; end if;
  if p_planning_status not in ('selected', 'bench') or p_raid_role not in ('tank', 'healer', 'dps') then raise exception 'Invalid raid planning values' using errcode = '22023'; end if;
  if not exists (select 1 from public.guild_members where id = p_guild_member_id and guild_id = v_guild_id) then raise exception 'Guild member is unavailable' using errcode = '42501'; end if;
  insert into public.guild_raid_operation_members (operation_id, guild_member_id, planning_status, raid_role, planned_by)
  values (p_operation_id, p_guild_member_id, p_planning_status, p_raid_role, v_actor)
  on conflict (operation_id, guild_member_id) do update set planning_status = excluded.planning_status, raid_role = excluded.raid_role, planned_by = excluded.planned_by;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.raid_operation_member_planned', 'guild_raid_operation_members', p_operation_id,
    jsonb_build_object('guild_member_id', p_guild_member_id, 'planning_status', p_planning_status, 'raid_role', p_raid_role));
end;
$$;

create or replace function public.create_guild_raid_assignment(
  p_operation_id uuid, p_title text, p_details text, p_assigned_guild_member_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then raise exception 'Guild leadership required' using errcode = '42501'; end if;
  if p_title is null or length(btrim(p_title)) = 0 or length(p_title) > 160 or p_details is null or length(p_details) > 2000 then raise exception 'Invalid assignment' using errcode = '22023'; end if;
  if p_assigned_guild_member_id is not null and not exists (select 1 from public.guild_members where id = p_assigned_guild_member_id and guild_id = v_guild_id) then raise exception 'Guild member is unavailable' using errcode = '42501'; end if;
  insert into public.guild_raid_assignments (operation_id, title, details, assigned_guild_member_id, created_by)
  values (p_operation_id, btrim(p_title), p_details, p_assigned_guild_member_id, v_actor) returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.raid_assignment_created', 'guild_raid_assignments', v_id, jsonb_build_object('operation_id', p_operation_id));
  return v_id;
end;
$$;

-- The event fields are read only through this narrow projection. A Guild leader
-- cannot query the Lodge event table or its RSVPs unless they separately have Lodge access.
create or replace function public.list_guild_raid_operations(p_guild_id uuid)
returns table (
  id uuid, event_id uuid, title text, activity_type text, event_date date,
  event_time time, difficulty text, operational_notes text, authorized_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select operation.id, event.id, event.title, event.activity_type, event.event_date,
    event.event_time, event.difficulty, operation.operational_notes, operation.authorized_at
  from public.guild_raid_operations operation
  join public.events event on event.id = operation.event_id
  where operation.guild_id = p_guild_id and private.can_lead_guild(p_guild_id)
  order by event.event_date, event.event_time nulls last, operation.id;
$$;

alter table public.guild_raid_operations enable row level security;
alter table public.guild_raid_operation_members enable row level security;
alter table public.guild_raid_assignments enable row level security;
revoke all on public.guild_raid_operations, public.guild_raid_operation_members, public.guild_raid_assignments from anon, authenticated;
grant select on public.guild_raid_operations, public.guild_raid_operation_members, public.guild_raid_assignments to authenticated;
create policy "guild_raid_operations_select_leadership" on public.guild_raid_operations for select to authenticated using (private.can_lead_guild(guild_id));
create policy "guild_raid_operation_members_select_leadership" on public.guild_raid_operation_members for select to authenticated using (private.can_manage_guild_raid_operation(operation_id));
create policy "guild_raid_assignments_select_leadership" on public.guild_raid_assignments for select to authenticated using (private.can_manage_guild_raid_operation(operation_id));

revoke all on function public.create_guild_raid_operation(uuid, uuid), public.set_guild_raid_operation_notes(uuid, text), public.set_guild_raid_operation_member(uuid, uuid, text, text), public.create_guild_raid_assignment(uuid, text, text, uuid) from public, anon;
grant execute on function public.create_guild_raid_operation(uuid, uuid), public.set_guild_raid_operation_notes(uuid, text), public.set_guild_raid_operation_member(uuid, uuid, text, text), public.create_guild_raid_assignment(uuid, text, text, uuid) to authenticated;
revoke all on function public.list_guild_raid_operations(uuid) from public, anon;
grant execute on function public.list_guild_raid_operations(uuid) to authenticated;
