-- Will requested a reset of all Travelers without Battle.net account-list proof.
-- Preserve shared community records, clearing only their deleted character link.
alter table public.event_attendees drop constraint event_attendees_character_id_fkey;
alter table public.event_attendees add constraint event_attendees_character_id_fkey
  foreign key (character_id) references public.characters(id) on delete set null;
alter table public.achievements drop constraint achievements_character_id_fkey;
alter table public.achievements add constraint achievements_character_id_fkey
  foreign key (character_id) references public.characters(id) on delete set null;

delete from public.characters c
where not exists (
  select 1 from public.wow_character_claims w
  where w.character_id = c.id and w.profile_id = c.profile_id
);

-- The trusted claim RPC inserts character and proof in one transaction.
-- A deferred check permits that ordering while rejecting public-name inserts.
create function private.require_traveler_claim() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_character_id uuid; v_character_ids uuid[];
begin
  if tg_table_name = 'characters' then
    v_character_ids := array[new.id];
  elsif tg_op = 'UPDATE' then
    v_character_ids := array[old.character_id, new.character_id];
  else
    v_character_ids := array[old.character_id];
  end if;
  foreach v_character_id in array v_character_ids loop
  if exists (
    select 1 from public.characters c where c.id = v_character_id
    and not exists (
      select 1 from public.wow_character_claims w
      where w.character_id = c.id and w.profile_id = c.profile_id
        and w.region = c.region and w.realm_slug = lower(c.realm_slug)
        and w.character_name = lower(c.character_name)
    )
  ) then
    raise exception 'Add Travelers from your connected Battle.net account.' using errcode = '23514';
  end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.require_traveler_claim() from public, anon, authenticated;
create constraint trigger require_traveler_claim
  after insert or update on public.characters
  deferrable initially deferred for each row execute function private.require_traveler_claim();
create constraint trigger retain_traveler_claim
  after delete or update on public.wow_character_claims
  deferrable initially deferred for each row execute function private.require_traveler_claim();

create function public.remove_owned_traveler(p_character_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_removed uuid;
begin
  if v_actor is null or not private.app_account_active() then
    raise exception 'Active sign-in required.' using errcode = '42501';
  end if;
  -- Serialize with Main selection and the trusted character importer.
  perform 1 from public.profiles where id = v_actor for update;
  delete from public.characters where id = p_character_id and profile_id = v_actor
    returning id into v_removed;
  if v_removed is null then
    raise exception 'Choose your own Traveler.' using errcode = '42501';
  end if;
  return v_removed;
end;
$$;
revoke all on function public.remove_owned_traveler(uuid) from public, anon;
grant execute on function public.remove_owned_traveler(uuid) to authenticated;
revoke delete on public.characters from authenticated;
