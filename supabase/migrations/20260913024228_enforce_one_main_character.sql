-- One main character per user.
-- First character becomes main; later additions are alternates.
-- Switching main happens through an authenticated database function.

-- Prevent character writes while existing records are reconciled.
lock table public.characters in share row exclusive mode;

-- Keep an existing main where possible.
-- Otherwise choose the earliest-added character.
with ranked as (
  select
    id,
    row_number() over (
      partition by profile_id
      order by is_main desc, created_at asc, id asc
    ) as position
  from public.characters
)
update public.characters as c
set is_main = (ranked.position = 1)
from ranked
where c.id = ranked.id
  and c.is_main is distinct from (ranked.position = 1);

create unique index characters_one_main_per_profile
  on public.characters (profile_id)
  where is_main = true;

-- Assign status automatically on insertion.
-- Lock the owner's profile to serialize additions and main switches.
create or replace function private.assign_character_main()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or new.profile_id is distinct from auth.uid()
  then
    raise exception 'You can only add your own saved characters.'
      using errcode = '42501';
  end if;

  perform 1
  from public.profiles
  where id = new.profile_id
  for update;

  if not found then
    raise exception 'Your profile could not be found.'
      using errcode = '42501';
  end if;

  new.is_main := not exists (
    select 1
    from public.characters
    where profile_id = new.profile_id
      and is_main = true
  );

  return new;
end;
$$;

revoke all on function private.assign_character_main()
  from public, anon, authenticated;

create trigger trg_assign_character_main
  before insert on public.characters
  for each row
  execute function private.assign_character_main();

-- Protect main status and ownership fields from direct client updates.
-- These permissions still allow the existing profile-save function.
revoke insert, update on public.characters
  from public, anon, authenticated;

grant insert (
  profile_id,
  game_id,
  region,
  realm_slug,
  character_name,
  class,
  faction,
  level
) on public.characters to authenticated;

grant update (
  class,
  faction,
  level
) on public.characters to authenticated;

-- A main must be replaced before it can be deleted.
drop policy "characters_delete_owner" on public.characters;

create policy "characters_delete_owner"
  on public.characters
  for delete
  to authenticated
  using (
    profile_id = (select auth.uid())
    and is_main = false
  );

-- Switch the user's main atomically.
create or replace function public.set_main_character(
  p_character_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Sign in before choosing a main character.'
      using errcode = '42501';
  end if;

  perform 1
  from public.profiles
  where id = v_actor
  for update;

  if not found then
    raise exception 'Your profile could not be found.'
      using errcode = '42501';
  end if;

  -- Lock the chosen character so it cannot disappear during the switch.
  perform 1
  from public.characters
  where id = p_character_id
    and profile_id = v_actor
  for update;

  if not found then
    raise exception 'Choose one of your own saved characters.'
      using errcode = '42501';
  end if;

  -- Demote first to satisfy the unique index.
  -- Both updates commit together or both roll back.
  update public.characters
  set is_main = false
  where profile_id = v_actor
    and is_main = true
    and id <> p_character_id;

  update public.characters
  set is_main = true
  where id = p_character_id
    and profile_id = v_actor
    and is_main = false;

  return p_character_id;
end;
$$;

revoke all on function public.set_main_character(uuid)
  from public, anon;

grant execute on function public.set_main_character(uuid)
  to authenticated;