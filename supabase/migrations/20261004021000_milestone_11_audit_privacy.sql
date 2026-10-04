-- Keep Guild discovery readable without exposing stable account identifiers.
revoke select on public.guild_artisan_offerings, public.guild_crafting_requests,
  public.guild_supply_goals from authenticated;
grant select (id, guild_id, character_label, profession, specialization,
  recipe_name, service_note, created_at)
  on public.guild_artisan_offerings to authenticated;
grant select (id, guild_id, requester_name, request_kind, item_name, quantity,
  details, status, volunteer_name, created_at)
  on public.guild_crafting_requests to authenticated;
grant select (id, guild_id, item_name, target_quantity, current_quantity,
  note, active, created_at)
  on public.guild_supply_goals to authenticated;

-- Closed goals are a leadership planning record, even through direct API reads.
drop policy guild_supply_goals_read on public.guild_supply_goals;
create policy guild_supply_goals_read on public.guild_supply_goals
  for select to authenticated using (
    (active and private.is_guild_member(guild_id)
      and private.has_active_guild_claim(guild_id))
    or private.can_manage_guild(guild_id)
  );

-- The page needs action flags, but Guild members do not need each other's IDs.
create function public.guild_artisan_action_flags(
  p_guild_id uuid, p_offering_ids uuid[], p_request_ids uuid[]
)
returns table (item_type text, item_id uuid, is_owner boolean, is_volunteer boolean)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or p_guild_id is null
    or coalesce(array_length(p_offering_ids, 1), 0) > 50
    or coalesce(array_length(p_request_ids, 1), 0) > 50
  then raise exception 'Invalid Artisan Hall flag request' using errcode = '22023'; end if;

  return query
  select 'offering'::text, offering.id, offering.profile_id = v_actor, false
  from public.guild_artisan_offerings offering
  where offering.guild_id = p_guild_id and offering.id = any(p_offering_ids)
    and (offering.profile_id = v_actor
      or (private.is_guild_member(p_guild_id)
        and private.has_active_guild_claim(p_guild_id)))
  union all
  select 'request'::text, request.id, request.requested_by = v_actor,
    coalesce(request.volunteered_by = v_actor, false)
  from public.guild_crafting_requests request
  where request.guild_id = p_guild_id and request.id = any(p_request_ids)
    and (request.requested_by = v_actor
      or (private.is_guild_member(p_guild_id)
        and private.has_active_guild_claim(p_guild_id)));
end;
$$;
revoke all on function public.guild_artisan_action_flags(uuid, uuid[], uuid[])
  from public, anon;
grant execute on function public.guild_artisan_action_flags(uuid, uuid[], uuid[])
  to authenticated;
