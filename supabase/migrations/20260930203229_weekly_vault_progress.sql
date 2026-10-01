-- Player-entered Vault context. This is never presented as Blizzard-verified data.
create table public.weekly_vault_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  reset_on date not null,
  raid_progress text not null default '' check (length(raid_progress) <= 160),
  dungeon_progress text not null default '' check (length(dungeon_progress) <= 160),
  world_progress text not null default '' check (length(world_progress) <= 160),
  notes text not null default '' check (length(notes) <= 500),
  updated_at timestamptz not null default now(),
  unique (character_id, reset_on)
);

create index idx_weekly_vault_progress_owner_reset
  on public.weekly_vault_progress(profile_id, reset_on desc);

create trigger trg_weekly_vault_progress_updated_at
  before update on public.weekly_vault_progress
  for each row execute function private.set_updated_at();

alter table public.weekly_vault_progress enable row level security;
revoke all on public.weekly_vault_progress from public, anon, authenticated;
grant select, insert on public.weekly_vault_progress to authenticated;
grant update (raid_progress, dungeon_progress, world_progress, notes)
  on public.weekly_vault_progress to authenticated;

create policy "weekly_vault_progress_select_owner"
  on public.weekly_vault_progress for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "weekly_vault_progress_insert_owned_character"
  on public.weekly_vault_progress for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
  );

create policy "weekly_vault_progress_update_owner"
  on public.weekly_vault_progress for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
  );

create function public.delete_guild_member_availability(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_guild_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.guild_member_availability
  where id = p_id and profile_id = v_actor
  returning guild_id into v_guild_id;
  if v_guild_id is null then
    raise exception 'Availability record not found' using errcode = '42501';
  end if;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.member_availability_deleted', 'guild_member_availability', p_id, '{}'::jsonb);
end;
$$;

revoke all on function public.delete_guild_member_availability(uuid) from public, anon;
grant execute on function public.delete_guild_member_availability(uuid) to authenticated;

-- Guild-owned calendar plans are separate from Lodge events and raid operations.
create table public.guild_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  category text not null check (category in ('mythic_plus', 'alt_run', 'achievement', 'meeting', 'social', 'trial', 'other')),
  event_date date not null,
  event_time time,
  details text not null default '' check (length(details) <= 1000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guild_calendar_entries_guild_date
  on public.guild_calendar_entries(guild_id, event_date, event_time);

create trigger trg_guild_calendar_entries_updated_at
  before update on public.guild_calendar_entries
  for each row execute function private.set_updated_at();

alter table public.guild_calendar_entries enable row level security;
revoke all on public.guild_calendar_entries from public, anon, authenticated;
grant select on public.guild_calendar_entries to authenticated;
create policy "guild_calendar_entries_select_member"
  on public.guild_calendar_entries for select to authenticated
  using (private.is_guild_member(guild_id));

create function public.create_guild_calendar_entry(
  p_guild_id uuid,
  p_title text,
  p_category text,
  p_event_date date,
  p_event_time time,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
begin
  if v_actor is null or not private.can_lead_guild(p_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 120
    or p_category not in ('mythic_plus', 'alt_run', 'achievement', 'meeting', 'social', 'trial', 'other')
    or p_event_date is null or p_details is null or length(p_details) > 1000 then
    raise exception 'Invalid Guild calendar entry' using errcode = '22023';
  end if;
  insert into public.guild_calendar_entries (guild_id, title, category, event_date, event_time, details, created_by)
  values (p_guild_id, btrim(p_title), p_category, p_event_date, p_event_time, btrim(p_details), v_actor)
  returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (p_guild_id, v_actor, 'guild.calendar_entry_created', 'guild_calendar_entries', v_id, jsonb_build_object('category', p_category));
  return v_id;
end;
$$;

create function public.delete_guild_calendar_entry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_calendar_entries where id = p_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  delete from public.guild_calendar_entries where id = p_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.calendar_entry_deleted', 'guild_calendar_entries', p_id, '{}'::jsonb);
end;
$$;

revoke all on function public.create_guild_calendar_entry(uuid, text, text, date, time, text) from public, anon;
grant execute on function public.create_guild_calendar_entry(uuid, text, text, date, time, text) to authenticated;
revoke all on function public.delete_guild_calendar_entry(uuid) from public, anon;
grant execute on function public.delete_guild_calendar_entry(uuid) to authenticated;
