-- Keep canonical Guild raid history when a Lodge event is removed.
alter table public.guild_raid_operations
  drop constraint guild_raid_operations_event_id_fkey,
  add constraint guild_raid_operations_event_id_fkey
    foreign key (event_id) references public.events(id) on delete restrict;

-- The creator must still belong to the Lodge at mutation time.
drop policy "events_delete_creator_or_admin" on public.events;
create policy "events_delete_creator_or_admin" on public.events
  for delete to authenticated using (
    private.is_lodge_member(lodge_id)
    and (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  );

-- Membership loss must not leave a former member in event participant counts.
create or replace function private.clear_departing_member_character_sharing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.character_lodges sharing using public.characters character
  where sharing.character_id = character.id
    and sharing.lodge_id = old.lodge_id
    and character.profile_id = old.profile_id;

  delete from public.character_raiderio_sharing sharing using public.characters character
  where sharing.character_id = character.id
    and sharing.lodge_id = old.lodge_id
    and character.profile_id = old.profile_id;

  delete from public.character_raidbots_reports report using public.characters character
  where report.character_id = character.id
    and report.lodge_id = old.lodge_id
    and character.profile_id = old.profile_id;

  delete from public.event_attendees attendee using public.events event
  where attendee.event_id = event.id
    and event.lodge_id = old.lodge_id
    and attendee.profile_id = old.profile_id;

  return old;
end;
$$;

-- Direct API writes must satisfy the same basic bounds as the server action.
alter table public.events
  add constraint events_title_content_check check (
    length(btrim(title)) between 1 and 120
    and length(title) <= 120
  ),
  add constraint events_activity_type_length_check check (
    activity_type is null or length(activity_type) <= 80
  ),
  add constraint events_difficulty_length_check check (
    difficulty is null or length(difficulty) <= 80
  ),
  add constraint events_notes_length_check check (
    notes is null or length(notes) <= 2000
  );

alter table public.event_attendees
  add constraint event_attendees_role_check check (
    role is null or role in ('tank', 'healer', 'damage', 'support', 'flexible')
  );
