-- Lock only the signed-in user's selected memberships.
-- This private helper avoids UPDATE-policy filtering on row locks.
create or replace function private.lock_my_lodge_memberships(
  p_lodge_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Sign in before changing Lodge sharing.'
      using errcode = '42501';
  end if;

  perform 1
  from public.lodge_members
  where profile_id = v_actor
    and lodge_id = any(p_lodge_ids)
  order by lodge_id
  for share;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.lock_my_lodge_memberships(uuid[])
  from public, anon;
grant execute on function private.lock_my_lodge_memberships(uuid[])
  to authenticated;

-- Replace a character's Lodge-sharing selections atomically.
-- Only the character owner can change these selections.
-- Every selected Lodge must include the owner as a member.

create or replace function public.set_character_lodge_sharing(
  p_character_id uuid,
  p_lodge_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_lodge_ids uuid[];
  v_membership_count integer;
begin
  if v_actor is null then
    raise exception 'Sign in before changing Lodge sharing.'
      using errcode = '42501';
  end if;

  if p_lodge_ids is null then
    raise exception 'Provide Lodge selections, or an empty list.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_lodge_ids) as selected(lodge_id)
    where selected.lodge_id is null
  ) then
    raise exception 'Invalid Lodge selection.'
      using errcode = '22023';
  end if;

  -- Remove duplicate selections.
  select coalesce(
    array_agg(distinct selected.lodge_id order by selected.lodge_id),
    '{}'::uuid[]
  )
  into v_lodge_ids
  from unnest(p_lodge_ids) as selected(lodge_id);

  -- Serialize sharing updates for this character and verify ownership.
  perform 1
  from public.characters
  where id = p_character_id
    and profile_id = v_actor
  for update;

  if not found then
    raise exception 'Choose one of your own saved characters.'
      using errcode = '42501';
  end if;

  -- The helper checks auth.uid() and locks only that user's memberships.
  v_membership_count := private.lock_my_lodge_memberships(v_lodge_ids);

  if v_membership_count <> cardinality(v_lodge_ids) then
    raise exception 'You must belong to every selected Lodge.'
      using errcode = '42501';
  end if;

  -- Remove unchecked Lodges. An empty selection removes all sharing.
  delete from public.character_lodges
  where character_id = p_character_id
    and not (lodge_id = any(v_lodge_ids));

  -- Add newly checked Lodges while preserving existing sharing dates.
  insert into public.character_lodges (character_id, lodge_id)
  select p_character_id, selected.lodge_id
  from unnest(v_lodge_ids) as selected(lodge_id)
  on conflict (character_id, lodge_id) do nothing;

  return p_character_id;
end;
$$;

revoke all on function public.set_character_lodge_sharing(uuid, uuid[])
  from public, anon;

grant execute on function public.set_character_lodge_sharing(uuid, uuid[])
  to authenticated;
