-- Save a character and its snapshot atomically.
-- Existing RLS policies enforce ownership.
-- Refreshing preserves main/alternate status and Lodge sharing.

create or replace function public.save_wow_character(
  p_region text,
  p_profile jsonb,
  p_fetched_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_game_id uuid;
  v_character_id uuid;
  v_region text := lower(btrim(p_region));
  v_realm text := lower(btrim(p_profile #>> '{realm,slug}'));
  v_name text := lower(btrim(p_profile ->> 'name'));
  v_level int;
begin
  if v_actor is null then
    raise exception 'Sign in before saving a character.'
      using errcode = '42501';
  end if;

  if v_region is null or v_region not in ('us', 'eu', 'kr', 'tw') then
    raise exception 'Invalid region.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_profile) is distinct from 'object'
    or coalesce(v_realm, '') = ''
    or coalesce(v_name, '') = ''
    or jsonb_typeof(p_profile -> 'level') is distinct from 'number'
    or coalesce(p_profile #>> '{character_class,name}', '') = ''
    or coalesce(p_profile #>> '{faction,name}', '') = ''
  then
    raise exception 'Invalid character profile.'
      using errcode = '22023';
  end if;

  if p_fetched_at is null
    or not isfinite(p_fetched_at)
    or p_fetched_at > clock_timestamp() + interval '5 minutes'
  then
    raise exception 'Invalid profile refresh timestamp.'
      using errcode = '22023';
  end if;

  v_level := (p_profile ->> 'level')::int;

  if v_level < 0 then
    raise exception 'Invalid character level.'
      using errcode = '22023';
  end if;

  select id into v_game_id
  from public.games
  where slug = 'wow';

  if v_game_id is null then
    raise exception 'World of Warcraft is not configured.';
  end if;

  insert into public.characters (
    profile_id,
    game_id,
    region,
    realm_slug,
    character_name,
    class,
    faction,
    level
  )
  values (
    v_actor,
    v_game_id,
    v_region,
    v_realm,
    v_name,
    p_profile #>> '{character_class,name}',
    p_profile #>> '{faction,name}',
    v_level
  )
  on conflict (profile_id, game_id, region, realm_slug, character_name)
  do update set
    class = excluded.class,
    faction = excluded.faction,
    level = excluded.level
  returning id into v_character_id;

  insert into public.character_snapshots (
    character_id,
    snapshot_data,
    source,
    last_refreshed_at
  )
  values (
    v_character_id,
    p_profile,
    'blizzard',
    p_fetched_at
  );

  return v_character_id;
end;
$$;

revoke all on function public.save_wow_character(text, jsonb, timestamptz)
  from public, anon;

grant execute on function public.save_wow_character(text, jsonb, timestamptz)
  to authenticated;