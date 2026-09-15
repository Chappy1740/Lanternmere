-- Official profile data is written only by the trusted server.
-- The server must obtain p_profile_id from auth.getUser(), never from the form.

-- Remove both table-level and any column-level write grants.
revoke insert, update, delete on public.characters, public.character_snapshots
  from public, anon, authenticated;

do $$
declare
  v_table text;
  v_columns text;
begin
  foreach v_table in array array['characters', 'character_snapshots'] loop
    select string_agg(quote_ident(attname), ', ' order by attnum)
    into v_columns
    from pg_attribute
    where attrelid = format('public.%I', v_table)::regclass
      and attnum > 0 and not attisdropped;

    execute format(
      'revoke insert (%s), update (%s) on public.%I from public, anon, authenticated',
      v_columns, v_columns, v_table
    );
  end loop;
end;
$$;

-- Defense in depth: remove ordinary-user profile write policies as well.
drop policy if exists "characters_insert_owner" on public.characters;
drop policy if exists "characters_update_owner" on public.characters;
drop policy if exists "characters_delete_owner" on public.characters;
drop policy if exists "character_snapshots_insert_owner" on public.character_snapshots;
drop policy if exists "character_snapshots_update_owner" on public.character_snapshots;

-- Trusted inserts use the server-verified owner ID rather than auth.uid().
-- Direct character inserts are no longer available to ordinary clients.
create or replace function private.assign_character_main()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is null then
    raise exception 'A character owner is required.' using errcode = '22023';
  end if;

  perform 1 from public.profiles
  where id = new.profile_id
  for update;

  if not found then
    raise exception 'Character owner profile not found.' using errcode = '23503';
  end if;

  new.is_main := not exists (
    select 1 from public.characters
    where profile_id = new.profile_id and is_main = true
  );
  return new;
end;
$$;

revoke all on function private.assign_character_main()
  from public, anon, authenticated;

-- Sharing needs a character row lock, which requires UPDATE privileges.
-- Its existing explicit auth.uid(), ownership, and membership checks stay in place.
-- Elevate this narrow operation instead of restoring arbitrary profile writes.
alter function public.set_character_lodge_sharing(uuid, uuid[])
  security definer;

-- Remove the former caller-supplied profile entry point.
drop function public.save_wow_character(text, jsonb, timestamptz);

-- Save a character and its snapshot atomically.
-- Existing RLS policies enforce ownership.
-- Refreshing preserves main/alternate status and Lodge sharing.

create or replace function public.save_verified_wow_character(
  p_profile_id uuid,
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
  v_actor uuid := p_profile_id;
  v_game_id uuid;
  v_character_id uuid;
  v_region text := lower(btrim(p_region));
  v_realm text := lower(btrim(p_profile #>> '{realm,slug}'));
  v_name text := lower(btrim(p_profile ->> 'name'));
  v_level int;
begin
  if current_user <> 'service_role' then
    raise exception 'Trusted server access required.' using errcode = '42501';
  end if;

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

revoke all on function public.save_verified_wow_character(uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_verified_wow_character(uuid, text, jsonb, timestamptz)
  to service_role;
