-- Keep stable account and Traveler IDs out of direct Guild board reads.
revoke select on public.guild_mythic_posts, public.guild_mythic_interests,
  public.guild_mythic_goals from authenticated;
grant select (id, guild_id, creator_name, dungeon, key_min, key_max, starts_at,
  tank_slots, healer_slots, damage_slots, note, status, created_at)
  on public.guild_mythic_posts to authenticated;
grant select (id, post_id, guild_id, member_name, character_label, role, score,
  score_source_url, score_refreshed_at, created_at)
  on public.guild_mythic_interests to authenticated;
grant select (id, guild_id, reset_on, target_runs, target_key_level,
  completed_runs, note, shared, updated_at)
  on public.guild_mythic_goals to authenticated;

-- Return only the viewer's action flags and their own Traveler ID. Rows remain
-- bounded and follow the same visibility rules as the three RLS policies.
create function public.guild_mythic_viewer_context(
  p_guild_id uuid, p_post_ids uuid[], p_interest_ids uuid[], p_goal_ids uuid[]
) returns table (
  record_kind text, record_id uuid, is_mine boolean,
  own_character_id uuid, member_name text
) language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or p_guild_id is null
    or cardinality(coalesce(p_post_ids, '{}'::uuid[])) > 30
    or cardinality(coalesce(p_interest_ids, '{}'::uuid[])) > 300
    or cardinality(coalesce(p_goal_ids, '{}'::uuid[])) > 100
  then raise exception 'Invalid viewer context' using errcode = '22023'; end if;
  return query
    select 'post'::text, p.id, p.created_by = v_actor, null::uuid, null::text
    from public.guild_mythic_posts p
    where p.guild_id = p_guild_id and p.id = any(coalesce(p_post_ids, '{}'::uuid[]))
      and (p.created_by = v_actor or
        (private.is_guild_member(p.guild_id) and private.has_active_guild_claim(p.guild_id)))
    union all
    select 'interest'::text, i.id, i.profile_id = v_actor,
      case when i.profile_id = v_actor then i.character_id else null::uuid end,
      null::text
    from public.guild_mythic_interests i
    where i.guild_id = p_guild_id and i.id = any(coalesce(p_interest_ids, '{}'::uuid[]))
      and (i.profile_id = v_actor or
        (private.is_guild_member(i.guild_id) and private.has_active_guild_claim(i.guild_id)))
    union all
    select 'goal'::text, g.id, g.profile_id = v_actor, null::uuid,
      case when g.shared then pr.display_name else null::text end
    from public.guild_mythic_goals g
    join public.profiles pr on pr.id = g.profile_id
    where g.guild_id = p_guild_id and g.id = any(coalesce(p_goal_ids, '{}'::uuid[]))
      and (g.profile_id = v_actor or
        (g.shared and private.is_guild_member(g.guild_id)
          and private.has_active_guild_claim(g.guild_id)));
end;
$$;

-- The owner can find earlier interests without making profile_id selectable.
create function public.guild_mythic_my_past_interests(p_guild_id uuid)
returns table (post_id uuid, dungeon text, starts_at timestamptz, score_shared boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.dungeon, p.starts_at, i.score_source_url is not null
  from public.guild_mythic_interests i
  join public.guild_mythic_posts p on p.id = i.post_id
  where i.profile_id = (select auth.uid()) and i.guild_id = p_guild_id
    and private.is_guild_member(p_guild_id)
    and private.has_active_guild_claim(p_guild_id)
  order by p.starts_at desc limit 100
$$;

-- Revocation works even when a group is closed or its start time has passed.
create function public.clear_guild_mythic_interest_score(p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  update public.guild_mythic_interests
  set score = null, score_source_url = null, score_refreshed_at = null
  where post_id = p_post_id and profile_id = v_actor
  returning guild_id into v_guild_id;
  if v_actor is null or v_guild_id is null
  then raise exception 'Interest not found' using errcode = '42501'; end if;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.mythic_score_cleared',
    'guild_mythic_interests', p_post_id);
end;
$$;

revoke all on function public.guild_mythic_viewer_context(uuid, uuid[], uuid[], uuid[])
  from public, anon;
revoke all on function public.guild_mythic_my_past_interests(uuid) from public, anon;
revoke all on function public.clear_guild_mythic_interest_score(uuid) from public, anon;
grant execute on function public.guild_mythic_viewer_context(uuid, uuid[], uuid[], uuid[])
  to authenticated;
grant execute on function public.guild_mythic_my_past_interests(uuid) to authenticated;
grant execute on function public.clear_guild_mythic_interest_score(uuid) to authenticated;
