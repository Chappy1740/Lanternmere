-- A failed upstream refresh must never replace the last successful Guild roster.
-- The narrow RPC records only a safe status message against an existing snapshot.
create or replace function public.record_guild_roster_refresh_failure(
  p_guild_id uuid,
  p_failure_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'record_guild_roster_refresh_failure: authentication required' using errcode = '42501';
  end if;
  if not private.can_manage_guild(p_guild_id) then
    raise exception 'record_guild_roster_refresh_failure: Guild management permission required' using errcode = '42501';
  end if;
  if p_failure_message is null or length(btrim(p_failure_message)) = 0 or length(p_failure_message) > 240 then
    raise exception 'record_guild_roster_refresh_failure: invalid failure message' using errcode = '22023';
  end if;

  update public.guild_blizzard_roster_snapshots
  set failure_message = btrim(p_failure_message)
  where guild_id = p_guild_id;
  if not found then return false; end if;

  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (p_guild_id, v_actor, 'guild.official_roster_refresh_failed', 'guild_blizzard_roster_snapshots', p_guild_id, jsonb_build_object('message', btrim(p_failure_message)));
  return true;
end;
$$;

revoke all on function public.record_guild_roster_refresh_failure(uuid, text) from public, anon;
grant execute on function public.record_guild_roster_refresh_failure(uuid, text) to authenticated;
