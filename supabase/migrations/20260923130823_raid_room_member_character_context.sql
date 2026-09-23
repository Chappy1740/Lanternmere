-- A planned member may deliberately select one already consented Traveler for
-- Raid Room decision support. The selection never grants new character access.
alter table public.guild_raid_operation_members
  add column character_id uuid references public.characters(id) on delete set null;

create or replace function public.set_guild_raid_operation_member_character(
  p_operation_id uuid, p_guild_member_id uuid, p_character_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_profile_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  select profile_id into v_profile_id from public.guild_members where id = p_guild_member_id and guild_id = v_guild_id;
  if v_profile_id is null or not exists (
    select 1 from public.character_guild_sharing sharing
    join public.characters character on character.id = sharing.character_id
    where sharing.character_id = p_character_id and sharing.guild_id = v_guild_id
      and character.profile_id = v_profile_id
  ) then raise exception 'Character context is not consented for this Guild member' using errcode = '42501'; end if;
  update public.guild_raid_operation_members set character_id = p_character_id where operation_id = p_operation_id and guild_member_id = p_guild_member_id;
  if not found then raise exception 'Guild member is not planned for this operation' using errcode = '42501'; end if;
  insert into public.guild_audit_events(guild_id, actor_id, action, target_table, target_id, metadata)
  values(v_guild_id, v_actor, 'guild.raid_member_character_selected', 'guild_raid_operation_members', p_operation_id, jsonb_build_object('guild_member_id',p_guild_member_id,'character_id',p_character_id));
end; $$;
revoke all on function public.set_guild_raid_operation_member_character(uuid,uuid,uuid) from public, anon;
grant execute on function public.set_guild_raid_operation_member_character(uuid,uuid,uuid) to authenticated;
