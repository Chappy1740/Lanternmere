-- Milestone 11: player-entered Guild crafting capabilities and planning.
-- No row represents verified recipe ownership, live inventory, or Guild-bank data.

create table public.guild_artisan_offerings (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  character_label text not null check (length(character_label) between 1 and 180),
  profession text not null check (length(btrim(profession)) between 1 and 60),
  specialization text not null default '' check (length(specialization) <= 80),
  recipe_name text not null default '' check (length(recipe_name) <= 120),
  service_note text not null default '' check (length(service_note) <= 500),
  created_at timestamptz not null default now(),
  unique (guild_id, character_id, profession, recipe_name)
);
create index idx_guild_artisan_offerings_discovery
  on public.guild_artisan_offerings(guild_id, profession, recipe_name);
create index idx_guild_artisan_offerings_owner
  on public.guild_artisan_offerings(guild_id, profile_id);

create table public.guild_crafting_requests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requester_name text not null check (length(requester_name) between 1 and 60),
  request_kind text not null check (request_kind in ('craft', 'consumable', 'material')),
  item_name text not null check (length(btrim(item_name)) between 1 and 120),
  quantity integer not null default 1 check (quantity between 1 and 1000000),
  details text not null default '' check (length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  volunteered_by uuid references public.profiles(id) on delete set null,
  volunteer_name text check (volunteer_name is null or length(volunteer_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((volunteered_by is null) = (volunteer_name is null)),
  check (status not in ('open', 'cancelled') or volunteered_by is null),
  check (status <> 'in_progress' or volunteered_by is not null)
);
create index idx_guild_crafting_requests_guild
  on public.guild_crafting_requests(guild_id, status, created_at desc);
create trigger trg_guild_crafting_requests_updated_at
  before update on public.guild_crafting_requests
  for each row execute function private.set_updated_at();

create table public.guild_supply_goals (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  item_name text not null check (length(btrim(item_name)) between 1 and 120),
  target_quantity integer not null check (target_quantity between 1 and 1000000),
  current_quantity integer not null default 0 check (current_quantity between 0 and 1000000),
  note text not null default '' check (length(note) <= 500),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_quantity <= target_quantity)
);
create index idx_guild_supply_goals_guild
  on public.guild_supply_goals(guild_id, active, created_at desc);
create trigger trg_guild_supply_goals_updated_at
  before update on public.guild_supply_goals
  for each row execute function private.set_updated_at();

alter table public.guild_artisan_offerings enable row level security;
alter table public.guild_crafting_requests enable row level security;
alter table public.guild_supply_goals enable row level security;
revoke all on public.guild_artisan_offerings, public.guild_crafting_requests,
  public.guild_supply_goals from public, anon, authenticated;
grant select on public.guild_artisan_offerings, public.guild_crafting_requests,
  public.guild_supply_goals to authenticated;
create policy guild_artisan_offerings_read on public.guild_artisan_offerings
  for select to authenticated using (
    profile_id = (select auth.uid())
    or (private.is_guild_member(guild_id) and private.has_active_guild_claim(guild_id))
  );
create policy guild_crafting_requests_read on public.guild_crafting_requests
  for select to authenticated using (
    requested_by = (select auth.uid())
    or (private.is_guild_member(guild_id) and private.has_active_guild_claim(guild_id))
  );
create policy guild_supply_goals_read on public.guild_supply_goals
  for select to authenticated using (
    private.is_guild_member(guild_id) and private.has_active_guild_claim(guild_id)
  );

create function public.add_guild_artisan_offering(
  p_guild_id uuid, p_character_id uuid, p_profession text,
  p_specialization text, p_recipe_name text, p_service_note text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_label text; v_id uuid;
begin
  if v_actor is null or not private.is_guild_member(p_guild_id)
    or not private.has_active_guild_claim(p_guild_id)
  then raise exception 'Verified Guild membership required' using errcode = '42501'; end if;
  select character.character_name || ' · ' || character.realm_slug into v_label
  from public.characters character join public.games game on game.id = character.game_id
  where character.id = p_character_id and character.profile_id = v_actor and game.slug = 'wow';
  if v_label is null or length(btrim(coalesce(p_profession, ''))) not between 1 and 60
    or length(coalesce(p_specialization, '')) > 80
    or length(coalesce(p_recipe_name, '')) > 120
    or length(coalesce(p_service_note, '')) > 500
  then raise exception 'Invalid crafting capability' using errcode = '22023'; end if;
  insert into public.guild_artisan_offerings
    (guild_id, profile_id, character_id, character_label, profession,
      specialization, recipe_name, service_note)
  values (p_guild_id, v_actor, p_character_id, v_label, btrim(p_profession),
    btrim(coalesce(p_specialization, '')), btrim(coalesce(p_recipe_name, '')),
    btrim(coalesce(p_service_note, '')))
  returning id into v_id;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.artisan_offering_added', 'guild_artisan_offerings', v_id);
  return v_id;
end;
$$;

create function public.delete_guild_artisan_offering(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_artisan_offerings
  where id = p_id and profile_id = v_actor;
  if v_actor is null or v_guild_id is null
  then raise exception 'Capability deletion not permitted' using errcode = '42501'; end if;
  delete from public.guild_artisan_offerings where id = p_id and profile_id = v_actor;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.artisan_offering_deleted', 'guild_artisan_offerings', p_id);
end;
$$;

create function public.create_guild_crafting_request(
  p_guild_id uuid, p_request_kind text, p_item_name text,
  p_quantity integer, p_details text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_name text; v_id uuid;
begin
  if v_actor is null or not private.is_guild_member(p_guild_id)
    or not private.has_active_guild_claim(p_guild_id)
  then raise exception 'Verified Guild membership required' using errcode = '42501'; end if;
  if p_request_kind not in ('craft', 'consumable', 'material')
    or length(btrim(coalesce(p_item_name, ''))) not between 1 and 120
    or p_quantity not between 1 and 1000000 or length(coalesce(p_details, '')) > 1000
  then raise exception 'Invalid crafting request' using errcode = '22023'; end if;
  select display_name into v_name from public.profiles where id = v_actor;
  if v_name is null then raise exception 'Requester profile missing' using errcode = '42501'; end if;
  insert into public.guild_crafting_requests
    (guild_id, requested_by, requester_name, request_kind, item_name, quantity, details)
  values (p_guild_id, v_actor, v_name, p_request_kind,
    btrim(p_item_name), p_quantity, btrim(coalesce(p_details, '')))
  returning id into v_id;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.crafting_request_created', 'guild_crafting_requests', v_id);
  return v_id;
end;
$$;

create function public.set_guild_crafting_request_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_request public.guild_crafting_requests; v_name text;
begin
  select * into v_request from public.guild_crafting_requests where id = p_id for update;
  if v_actor is null or v_request.id is null
    or not private.is_guild_member(v_request.guild_id)
    or not private.has_active_guild_claim(v_request.guild_id)
  then raise exception 'Verified Guild membership required' using errcode = '42501'; end if;
  if v_request.status in ('completed', 'cancelled')
    or (p_status = 'in_progress' and v_request.status <> 'open')
    or (p_status in ('open', 'completed') and v_request.status <> 'in_progress')
    or (p_status = 'cancelled' and v_request.status not in ('open', 'in_progress'))
    or p_status not in ('in_progress', 'open', 'completed', 'cancelled')
  then raise exception 'Invalid request transition' using errcode = '22023'; end if;
  if p_status in ('open', 'completed')
    and v_actor <> v_request.requested_by and v_actor is distinct from v_request.volunteered_by
    and not private.can_manage_guild(v_request.guild_id)
  then raise exception 'Request update not permitted' using errcode = '42501'; end if;
  if p_status = 'cancelled' and v_actor <> v_request.requested_by
    and not private.can_manage_guild(v_request.guild_id)
  then raise exception 'Request cancellation not permitted' using errcode = '42501'; end if;
  if p_status = 'in_progress' then
    select display_name into v_name from public.profiles where id = v_actor;
    if v_name is null then raise exception 'Volunteer profile missing' using errcode = '42501'; end if;
  end if;
  update public.guild_crafting_requests
  set status = p_status,
    volunteered_by = case when p_status = 'in_progress' then v_actor
      when p_status in ('open', 'cancelled') then null else volunteered_by end,
    volunteer_name = case when p_status = 'in_progress' then v_name
      when p_status in ('open', 'cancelled') then null else volunteer_name end
  where id = p_id;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_request.guild_id, v_actor, 'guild.crafting_request_status',
    'guild_crafting_requests', p_id, jsonb_build_object('status', p_status));
end;
$$;

create function public.delete_guild_crafting_request(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_request public.guild_crafting_requests;
begin
  select * into v_request from public.guild_crafting_requests where id = p_id for update;
  if v_actor is null or v_request.id is null
    or (v_request.requested_by <> v_actor and not private.can_manage_guild(v_request.guild_id))
  then raise exception 'Request deletion not permitted' using errcode = '42501'; end if;
  delete from public.guild_crafting_requests where id = p_id;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (v_request.guild_id, v_actor, 'guild.crafting_request_deleted',
    'guild_crafting_requests', p_id);
end;
$$;

create function public.save_guild_supply_goal(
  p_guild_id uuid, p_id uuid, p_item_name text,
  p_target_quantity integer, p_current_quantity integer,
  p_note text, p_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null or not private.can_manage_guild(p_guild_id)
  then raise exception 'Verified Guild leadership required' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_item_name, ''))) not between 1 and 120
    or p_target_quantity not between 1 and 1000000
    or p_current_quantity not between 0 and p_target_quantity
    or length(coalesce(p_note, '')) > 500 or p_active is null
  then raise exception 'Invalid supply goal' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.guild_supply_goals
      (guild_id, item_name, target_quantity, current_quantity, note, active, created_by)
    values (p_guild_id, btrim(p_item_name), p_target_quantity,
      p_current_quantity, btrim(coalesce(p_note, '')), p_active, v_actor)
    returning id into v_id;
  else
    update public.guild_supply_goals
    set item_name = btrim(p_item_name), target_quantity = p_target_quantity,
      current_quantity = p_current_quantity, note = btrim(coalesce(p_note, '')),
      active = p_active
    where id = p_id and guild_id = p_guild_id returning id into v_id;
    if v_id is null then raise exception 'Supply goal not found' using errcode = '22023'; end if;
  end if;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id, metadata)
  values (p_guild_id, v_actor, 'guild.supply_goal_saved', 'guild_supply_goals', v_id,
    jsonb_build_object('active', p_active));
  return v_id;
end;
$$;

create function private.clear_artisan_member_on_exit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.guild_artisan_offerings
  where guild_id = old.guild_id and profile_id = old.profile_id;
  delete from public.guild_crafting_requests
  where guild_id = old.guild_id and requested_by = old.profile_id;
  update public.guild_crafting_requests
  set status = case when status = 'in_progress' then 'open' else status end,
    volunteered_by = null, volunteer_name = null
  where guild_id = old.guild_id and volunteered_by = old.profile_id;
  update public.guild_supply_goals set created_by = null
  where guild_id = old.guild_id and created_by = old.profile_id;
  return old;
end;
$$;
create trigger trg_clear_artisan_member_on_exit
  after delete on public.guild_members
  for each row execute function private.clear_artisan_member_on_exit();
revoke all on function private.clear_artisan_member_on_exit() from public, anon, authenticated;

revoke all on function public.add_guild_artisan_offering(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.delete_guild_artisan_offering(uuid) from public, anon;
revoke all on function public.create_guild_crafting_request(uuid, text, text, integer, text) from public, anon;
revoke all on function public.set_guild_crafting_request_status(uuid, text) from public, anon;
revoke all on function public.delete_guild_crafting_request(uuid) from public, anon;
revoke all on function public.save_guild_supply_goal(uuid, uuid, text, integer, integer, text, boolean) from public, anon;
grant execute on function public.add_guild_artisan_offering(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_guild_artisan_offering(uuid) to authenticated;
grant execute on function public.create_guild_crafting_request(uuid, text, text, integer, text) to authenticated;
grant execute on function public.set_guild_crafting_request_status(uuid, text) to authenticated;
grant execute on function public.delete_guild_crafting_request(uuid) to authenticated;
grant execute on function public.save_guild_supply_goal(uuid, uuid, text, integer, integer, text, boolean) to authenticated;
