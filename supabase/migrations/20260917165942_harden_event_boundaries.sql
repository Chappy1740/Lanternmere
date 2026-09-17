-- Milestone 4: preserve event and attendance ownership boundaries.
--
-- Events are Lodge-scoped records. Once created, neither the Lodge nor the
-- creator may change, even when a user belongs to more than one Lodge. RSVP
-- rows must remain self-owned and tied to an event the caller may read.

create or replace function private.prevent_event_identity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lodge_id is distinct from old.lodge_id then
    raise exception 'An event cannot be moved to another Lodge.';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'An event creator cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_prevent_identity_changes on public.events;

create trigger trg_events_prevent_identity_changes
  before update on public.events
  for each row execute function private.prevent_event_identity_changes();

drop policy "event_attendees_insert_self" on public.event_attendees;
drop policy "event_attendees_update_self" on public.event_attendees;

create policy "event_attendees_insert_self" on public.event_attendees
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and private.can_read_event(event_id)
    and (character_id is null or private.owns_character(character_id))
  );

create policy "event_attendees_update_self" on public.event_attendees
  for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and private.can_read_event(event_id)
    and (character_id is null or private.owns_character(character_id))
  );
