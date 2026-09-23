-- Guild identity changes use one audited, server-authorized path.
drop policy if exists "guilds_update_management" on public.guilds;
revoke update on public.guilds from authenticated;

create or replace function public.set_guild_identity(p_guild_id uuid, p_name text, p_description text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_name text;
begin
  if v_actor is null or not private.can_manage_guild(p_guild_id) then
    raise exception 'Guild management required' using errcode = '42501';
  end if;
  v_name := btrim(coalesce(p_name, ''));
  if length(v_name) = 0 or length(v_name) > 60 or length(coalesce(p_description, '')) > 1000 then
    raise exception 'Invalid Guild identity' using errcode = '22023';
  end if;
  update public.guilds set name = v_name, description = nullif(btrim(coalesce(p_description, '')), '') where id = p_guild_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.identity_updated', 'guilds', p_guild_id);
end;
$$;
revoke all on function public.set_guild_identity(uuid, text, text) from public, anon;
grant execute on function public.set_guild_identity(uuid, text, text) to authenticated;
