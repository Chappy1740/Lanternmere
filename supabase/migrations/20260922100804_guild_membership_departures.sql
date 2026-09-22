-- Membership departures are explicit and revoke Guild-scoped character sharing.
-- A Guild Master is protected from self-removal; transfer ownership first.
create or replace function public.leave_guild(p_guild_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_member_id uuid;
begin
  select id into v_member_id from public.guild_members
  where guild_id = p_guild_id and profile_id = v_actor for update;
  if v_actor is null or v_member_id is null then raise exception 'leave_guild: membership required' using errcode = '42501'; end if;
  if private.has_guild_role(p_guild_id, 'guild_master') then raise exception 'leave_guild: transfer Guild Master ownership first' using errcode = '42501'; end if;
  delete from public.character_guild_sharing sharing using public.characters character
  where sharing.guild_id = p_guild_id and sharing.character_id = character.id and character.profile_id = v_actor;
  update public.guild_ownership_transfers set canceled_at = now(), canceled_by = v_actor
  where guild_id = p_guild_id and to_member_id = v_member_id and accepted_at is null and canceled_at is null;
  delete from public.guild_members where id = v_member_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.member_left', 'guild_members', v_member_id);
end;
$$;

create or replace function public.remove_guild_member(p_guild_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_target_profile_id uuid;
begin
  select guild_id, profile_id into v_guild_id, v_target_profile_id from public.guild_members
  where id = p_guild_member_id for update;
  if v_actor is null or v_guild_id is null or not private.has_guild_role(v_guild_id, 'guild_master') then
    raise exception 'remove_guild_member: Guild Master required' using errcode = '42501';
  end if;
  if v_target_profile_id = v_actor or private.has_guild_role(v_guild_id, 'guild_master') and exists (
    select 1 from public.guild_member_roles where guild_member_id = p_guild_member_id and role = 'guild_master'
  ) then raise exception 'remove_guild_member: cannot remove Guild Master' using errcode = '42501'; end if;
  delete from public.character_guild_sharing sharing using public.characters character
  where sharing.guild_id = v_guild_id and sharing.character_id = character.id and character.profile_id = v_target_profile_id;
  update public.guild_ownership_transfers set canceled_at = now(), canceled_by = v_actor
  where guild_id = v_guild_id and to_member_id = p_guild_member_id and accepted_at is null and canceled_at is null;
  delete from public.guild_members where id = p_guild_member_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.member_removed', 'guild_members', p_guild_member_id);
end;
$$;

revoke all on function public.leave_guild(uuid) from public, anon;
revoke all on function public.remove_guild_member(uuid) from public, anon;
grant execute on function public.leave_guild(uuid) to authenticated;
grant execute on function public.remove_guild_member(uuid) to authenticated;
