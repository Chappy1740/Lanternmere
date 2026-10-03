-- Milestone 12: member-directed Mythic+ planning. Interest is not a party invite.
-- Raider.IO values are copied only after explicit per-post consent and retain source/freshness.
create table public.guild_mythic_posts (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  creator_name text not null check (length(creator_name) between 1 and 60),
  dungeon text not null check (length(btrim(dungeon)) between 1 and 120),
  key_min integer not null check (key_min between 2 and 40),
  key_max integer not null check (key_max between key_min and 40),
  starts_at timestamptz not null,
  tank_slots integer not null check (tank_slots between 0 and 1),
  healer_slots integer not null check (healer_slots between 0 and 1),
  damage_slots integer not null check (damage_slots between 0 and 3),
  note text not null default '' check (length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tank_slots + healer_slots + damage_slots between 1 and 5)
);
create index idx_guild_mythic_posts_guild_time
  on public.guild_mythic_posts(guild_id, starts_at, status);
create trigger trg_guild_mythic_posts_updated_at before update on public.guild_mythic_posts
  for each row execute function private.set_updated_at();

create table public.guild_mythic_interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.guild_mythic_posts(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_name text not null check (length(member_name) between 1 and 60),
  character_id uuid not null references public.characters(id) on delete cascade,
  character_label text not null check (length(character_label) between 1 and 180),
  role text not null check (role in ('tank', 'healer', 'damage')),
  score numeric,
  score_source_url text,
  score_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, profile_id),
  check ((score_source_url is null) = (score_refreshed_at is null))
);
create index idx_guild_mythic_interests_guild_post
  on public.guild_mythic_interests(guild_id, post_id);

create table public.guild_mythic_goals (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reset_on date not null,
  target_runs integer not null check (target_runs between 1 and 100),
  target_key_level integer not null check (target_key_level between 2 and 40),
  completed_runs integer not null check (completed_runs between 0 and 100),
  note text not null default '' check (length(note) <= 300),
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (guild_id, profile_id, reset_on)
);
create index idx_guild_mythic_goals_guild_reset
  on public.guild_mythic_goals(guild_id, reset_on, shared);
create trigger trg_guild_mythic_goals_updated_at before update on public.guild_mythic_goals
  for each row execute function private.set_updated_at();

alter table public.guild_mythic_posts enable row level security;
alter table public.guild_mythic_interests enable row level security;
alter table public.guild_mythic_goals enable row level security;
revoke all on public.guild_mythic_posts, public.guild_mythic_interests,
  public.guild_mythic_goals from public, anon, authenticated;
grant select on public.guild_mythic_posts, public.guild_mythic_interests,
  public.guild_mythic_goals to authenticated;
create policy guild_mythic_posts_read on public.guild_mythic_posts
  for select to authenticated using (
    created_by = (select auth.uid()) or
    (private.is_guild_member(guild_id) and private.has_active_guild_claim(guild_id))
  );
create policy guild_mythic_interests_read on public.guild_mythic_interests
  for select to authenticated using (
    profile_id = (select auth.uid()) or
    (private.is_guild_member(guild_id) and private.has_active_guild_claim(guild_id))
  );
create policy guild_mythic_goals_read on public.guild_mythic_goals
  for select to authenticated using (
    profile_id = (select auth.uid()) or
    (shared and private.is_guild_member(guild_id) and private.has_active_guild_claim(guild_id))
  );

create function public.create_guild_mythic_post(
  p_guild_id uuid, p_dungeon text, p_key_min integer, p_key_max integer,
  p_starts_at timestamptz, p_tank_slots integer, p_healer_slots integer,
  p_damage_slots integer, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_name text; v_id uuid;
begin
  if v_actor is null or not private.is_guild_member(p_guild_id)
    or not private.has_active_guild_claim(p_guild_id)
  then raise exception 'Verified Guild membership required' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_dungeon, ''))) not between 1 and 120
    or p_key_min not between 2 and 40 or p_key_max not between p_key_min and 40
    or p_starts_at is null or p_starts_at < now() or p_starts_at > now() + interval '90 days'
    or p_tank_slots not between 0 and 1 or p_healer_slots not between 0 and 1
    or p_damage_slots not between 0 and 3
    or p_tank_slots + p_healer_slots + p_damage_slots not between 1 and 5
    or length(coalesce(p_note, '')) > 500
  then raise exception 'Invalid Mythic+ post' using errcode = '22023'; end if;
  select display_name into v_name from public.profiles where id = v_actor;
  if v_name is null then raise exception 'Profile missing' using errcode = '42501'; end if;
  insert into public.guild_mythic_posts
    (guild_id, created_by, creator_name, dungeon, key_min, key_max, starts_at,
      tank_slots, healer_slots, damage_slots, note)
  values (p_guild_id, v_actor, v_name, btrim(p_dungeon), p_key_min, p_key_max,
    p_starts_at, p_tank_slots, p_healer_slots, p_damage_slots, btrim(coalesce(p_note, '')))
  returning id into v_id;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.mythic_post_created', 'guild_mythic_posts', v_id);
  return v_id;
end;
$$;

create function public.set_guild_mythic_post_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_post public.guild_mythic_posts;
begin
  select * into v_post from public.guild_mythic_posts where id = p_id for update;
  if v_actor is null or v_post.id is null
    or not private.is_guild_member(v_post.guild_id)
    or not private.has_active_guild_claim(v_post.guild_id)
    or (v_post.created_by <> v_actor and not private.can_lead_guild(v_post.guild_id))
  then raise exception 'Post update not permitted' using errcode = '42501'; end if;
  if p_status not in ('open', 'closed') or v_post.starts_at <= now()
  then raise exception 'Invalid post status' using errcode = '22023'; end if;
  update public.guild_mythic_posts set status = p_status where id = p_id;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_post.guild_id, v_actor, 'guild.mythic_post_status', 'guild_mythic_posts',
    p_id, jsonb_build_object('status', p_status));
end;
$$;

create function public.delete_guild_mythic_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_post public.guild_mythic_posts;
begin
  select * into v_post from public.guild_mythic_posts where id = p_id for update;
  if v_actor is null or v_post.id is null
    or (v_post.created_by <> v_actor and not private.can_lead_guild(v_post.guild_id))
  then raise exception 'Post deletion not permitted' using errcode = '42501'; end if;
  delete from public.guild_mythic_posts where id = p_id;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id)
  values (v_post.guild_id, v_actor, 'guild.mythic_post_deleted', 'guild_mythic_posts', p_id);
end;
$$;

create function public.set_guild_mythic_interest(
  p_post_id uuid, p_character_id uuid, p_role text, p_share_score boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid()); v_post public.guild_mythic_posts;
  v_name text; v_label text; v_score numeric; v_url text; v_refreshed timestamptz;
begin
  select * into v_post from public.guild_mythic_posts where id = p_post_id for update;
  if v_actor is null or v_post.id is null or v_post.status <> 'open'
    or v_post.starts_at <= now() or not private.is_guild_member(v_post.guild_id)
    or not private.has_active_guild_claim(v_post.guild_id)
  then raise exception 'Open verified Guild post required' using errcode = '42501'; end if;
  if p_role not in ('tank', 'healer', 'damage') or p_share_score is null
    or (p_role = 'tank' and v_post.tank_slots = 0)
    or (p_role = 'healer' and v_post.healer_slots = 0)
    or (p_role = 'damage' and v_post.damage_slots = 0)
  then raise exception 'Invalid requested role' using errcode = '22023'; end if;
  select c.character_name || ' · ' || c.realm_slug into v_label
  from public.characters c join public.games g on g.id = c.game_id
  where c.id = p_character_id and c.profile_id = v_actor and g.slug = 'wow';
  select display_name into v_name from public.profiles where id = v_actor;
  if v_label is null or v_name is null
  then raise exception 'Owned Traveler required' using errcode = '42501'; end if;
  if p_share_score then
    select mythic_plus_score, source_url, refreshed_at
    into v_score, v_url, v_refreshed
    from public.character_raiderio_snapshots where character_id = p_character_id;
  end if;
  insert into public.guild_mythic_interests
    (post_id, guild_id, profile_id, member_name, character_id, character_label,
      role, score, score_source_url, score_refreshed_at)
  values (p_post_id, v_post.guild_id, v_actor, v_name, p_character_id, v_label,
    p_role, v_score, v_url, v_refreshed)
  on conflict (post_id, profile_id) do update set
    member_name = excluded.member_name,
    character_id = excluded.character_id, character_label = excluded.character_label,
    role = excluded.role, score = excluded.score,
    score_source_url = excluded.score_source_url,
    score_refreshed_at = excluded.score_refreshed_at;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id)
  values (v_post.guild_id, v_actor, 'guild.mythic_interest_set', 'guild_mythic_interests', p_post_id);
end;
$$;

create function public.remove_guild_mythic_interest(p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  delete from public.guild_mythic_interests
  where post_id = p_post_id and profile_id = v_actor returning guild_id into v_guild_id;
  if v_actor is null or v_guild_id is null
  then raise exception 'Interest not found' using errcode = '42501'; end if;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.mythic_interest_removed', 'guild_mythic_interests', p_post_id);
end;
$$;

create function public.save_guild_mythic_goal(
  p_guild_id uuid, p_reset_on date, p_target_runs integer,
  p_target_key_level integer, p_completed_runs integer, p_note text, p_shared boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null or not private.is_guild_member(p_guild_id)
    or not private.has_active_guild_claim(p_guild_id)
  then raise exception 'Verified Guild membership required' using errcode = '42501'; end if;
  if p_reset_on is null or p_reset_on < current_date - 7 or p_reset_on > current_date + 14
    or p_target_runs not between 1 and 100 or p_target_key_level not between 2 and 40
    or p_completed_runs not between 0 and 100 or length(coalesce(p_note, '')) > 300
    or p_shared is null
  then raise exception 'Invalid weekly goal' using errcode = '22023'; end if;
  insert into public.guild_mythic_goals
    (guild_id, profile_id, reset_on, target_runs, target_key_level,
      completed_runs, note, shared)
  values (p_guild_id, v_actor, p_reset_on, p_target_runs, p_target_key_level,
    p_completed_runs, btrim(coalesce(p_note, '')), p_shared)
  on conflict (guild_id, profile_id, reset_on) do update set
    target_runs = excluded.target_runs, target_key_level = excluded.target_key_level,
    completed_runs = excluded.completed_runs, note = excluded.note, shared = excluded.shared
  returning id into v_id;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.mythic_goal_saved', 'guild_mythic_goals', v_id);
  return v_id;
end;
$$;

create function private.clear_mythic_member_on_exit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.guild_mythic_posts where guild_id = old.guild_id and created_by = old.profile_id;
  delete from public.guild_mythic_interests where guild_id = old.guild_id and profile_id = old.profile_id;
  delete from public.guild_mythic_goals where guild_id = old.guild_id and profile_id = old.profile_id;
  return old;
end;
$$;
create trigger trg_clear_mythic_member_on_exit after delete on public.guild_members
  for each row execute function private.clear_mythic_member_on_exit();
revoke all on function private.clear_mythic_member_on_exit() from public, anon, authenticated;

-- Old group interests and goals should not accumulate forever after they leave the board.
create function private.purge_expired_guild_mythic_data()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_posts integer; v_goals integer;
begin
  delete from public.guild_mythic_posts where starts_at < now() - interval '30 days';
  get diagnostics v_posts = row_count;
  delete from public.guild_mythic_goals where reset_on < current_date - 90;
  get diagnostics v_goals = row_count;
  return v_posts + v_goals;
end;
$$;
revoke all on function private.purge_expired_guild_mythic_data() from public, anon, authenticated;

revoke all on function public.create_guild_mythic_post(uuid, text, integer, integer, timestamptz, integer, integer, integer, text) from public, anon;
revoke all on function public.set_guild_mythic_post_status(uuid, text) from public, anon;
revoke all on function public.delete_guild_mythic_post(uuid) from public, anon;
revoke all on function public.set_guild_mythic_interest(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.remove_guild_mythic_interest(uuid) from public, anon;
revoke all on function public.save_guild_mythic_goal(uuid, date, integer, integer, integer, text, boolean) from public, anon;
grant execute on function public.create_guild_mythic_post(uuid, text, integer, integer, timestamptz, integer, integer, integer, text) to authenticated;
grant execute on function public.set_guild_mythic_post_status(uuid, text) to authenticated;
grant execute on function public.delete_guild_mythic_post(uuid) to authenticated;
grant execute on function public.set_guild_mythic_interest(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.remove_guild_mythic_interest(uuid) to authenticated;
grant execute on function public.save_guild_mythic_goal(uuid, date, integer, integer, integer, text, boolean) to authenticated;

select cron.schedule('lanternmere-mythic-retention', '35 4 * * *',
  'select private.purge_expired_guild_mythic_data()');
