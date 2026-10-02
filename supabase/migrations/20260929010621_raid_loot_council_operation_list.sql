-- Loot Council can discover only the canonical raids attached to its Guild.
-- This projection does not expose Lodge events, RSVPs, planning, or encounters.
create or replace function public.list_guild_raid_loot_operations(p_guild_id uuid)
returns table (id uuid, title text, event_date date, event_time time)
language sql stable security definer set search_path = '' as $$
  select operation.id, event.title, event.event_date, event.event_time
  from public.guild_raid_operations operation
  join public.events event on event.id = operation.event_id
  where operation.guild_id = p_guild_id
    and (select auth.uid()) is not null
    and private.can_manage_guild_loot(p_guild_id)
  order by event.event_date, event.event_time nulls last, operation.id;
$$;

revoke all on function public.list_guild_raid_loot_operations(uuid) from public, anon;
grant execute on function public.list_guild_raid_loot_operations(uuid) to authenticated;
