-- =============================================================================
-- Lanternmere — 0002: break RLS policy recursion, split overlapping policies,
--                     add covering indexes
--
-- =============================================================================
-- CRITICAL FIX — infinite recursion between characters and character_lodges
-- =============================================================================
-- In 0001, the characters SELECT policy contained a subquery over
-- character_lodges, and the character_lodges SELECT policy contained a subquery
-- over characters. A policy subquery over an RLS-protected table triggers THAT
-- table's policies, so:
--
--     select * from characters
--       -> characters policy queries character_lodges
--          -> character_lodges policy queries characters
--             -> characters policy queries character_lodges  ... forever
--
-- PostgreSQL detects the cycle and aborts:
--
--     ERROR 42P17: infinite recursion detected in policy for relation "characters"
--
-- Nothing in Milestone 1 touched these tables, so 0001 applied and tested clean.
-- The first character query in Milestone 2 would have failed outright.
--
-- The fix is the same principle already used for lodge membership: a policy
-- must never reach into another RLS-protected table directly. Every
-- cross-table check moves into a SECURITY DEFINER helper in `private`, which
-- reads the underlying tables with the definer's rights. Policy evaluation
-- stays flat and terminates.
--
-- Also addressed (Supabase performance linter):
--   * multiple_permissive_policies on characters — `characters_owner_write` was
--     FOR ALL, which includes SELECT, so two permissive SELECT policies were
--     evaluated and OR'd on every row. Split into INSERT/UPDATE/DELETE.
--   * unindexed_foreign_keys — a FK with no covering index makes deleting a
--     parent row sequentially scan the child table. Deleting one profile
--     currently scans seven tables end to end.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Character access helpers (SECURITY DEFINER, unexposed schema)
-- -----------------------------------------------------------------------------
create or replace function private.owns_character(p_character_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.characters c
    where c.id = p_character_id
      and c.profile_id = (select auth.uid())
  );
$$;

create or replace function private.character_shared_with_me(p_character_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.character_lodges cl
    join public.lodge_members lm on lm.lodge_id = cl.lodge_id
    where cl.character_id = p_character_id
      and lm.profile_id = (select auth.uid())
  );
$$;

create or replace function private.can_read_character(p_character_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.owns_character(p_character_id)
      or private.character_shared_with_me(p_character_id);
$$;

-- -----------------------------------------------------------------------------
-- 2. Event access helpers — same principle, one hop instead of a nested policy
-- -----------------------------------------------------------------------------
create or replace function private.can_read_event(p_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.lodge_members lm on lm.lodge_id = e.lodge_id
    where e.id = p_event_id
      and lm.profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_event_lodge_admin(p_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.lodge_members lm on lm.lodge_id = e.lodge_id
    where e.id = p_event_id
      and lm.profile_id = (select auth.uid())
      and lm.role in ('owner', 'caretaker')
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. characters — break recursion, split the FOR ALL policy
-- -----------------------------------------------------------------------------
drop policy "characters_select_owner_or_lodgemate" on public.characters;
drop policy "characters_owner_write" on public.characters;

create policy "characters_select_owner_or_lodgemate" on public.characters
  for select using (
    profile_id = (select auth.uid())
    or private.character_shared_with_me(id)
  );

create policy "characters_insert_owner" on public.characters
  for insert with check (profile_id = (select auth.uid()));

create policy "characters_update_owner" on public.characters
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "characters_delete_owner" on public.characters
  for delete using (profile_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. character_lodges — no direct reads of characters
-- -----------------------------------------------------------------------------
drop policy "character_lodges_select_member" on public.character_lodges;
drop policy "character_lodges_insert_owner" on public.character_lodges;
drop policy "character_lodges_delete_owner" on public.character_lodges;

create policy "character_lodges_select_member" on public.character_lodges
  for select using (
    private.is_lodge_member(lodge_id)
    or private.owns_character(character_id)
  );

create policy "character_lodges_insert_owner" on public.character_lodges
  for insert with check (
    private.owns_character(character_id)
    and private.is_lodge_member(lodge_id)
  );

create policy "character_lodges_delete_owner" on public.character_lodges
  for delete using (private.owns_character(character_id));

-- -----------------------------------------------------------------------------
-- 5. character_snapshots — no direct reads of characters
-- -----------------------------------------------------------------------------
drop policy "character_snapshots_select_owner_or_lodgemate" on public.character_snapshots;
drop policy "character_snapshots_insert_owner" on public.character_snapshots;
drop policy "character_snapshots_update_owner" on public.character_snapshots;

create policy "character_snapshots_select_owner_or_lodgemate" on public.character_snapshots
  for select using (private.can_read_character(character_id));

create policy "character_snapshots_insert_owner" on public.character_snapshots
  for insert with check (private.owns_character(character_id));

create policy "character_snapshots_update_owner" on public.character_snapshots
  for update using (private.owns_character(character_id))
  with check (private.owns_character(character_id));

-- -----------------------------------------------------------------------------
-- 6. event_attendees — no direct reads of events
-- -----------------------------------------------------------------------------
drop policy "event_attendees_select_member" on public.event_attendees;
drop policy "event_attendees_insert_self" on public.event_attendees;
drop policy "event_attendees_delete_self_or_admin" on public.event_attendees;

create policy "event_attendees_select_member" on public.event_attendees
  for select using (private.can_read_event(event_id));

create policy "event_attendees_insert_self" on public.event_attendees
  for insert with check (
    profile_id = (select auth.uid())
    and private.can_read_event(event_id)
  );

create policy "event_attendees_delete_self_or_admin" on public.event_attendees
  for delete using (
    profile_id = (select auth.uid())
    or private.is_event_lodge_admin(event_id)
  );

-- -----------------------------------------------------------------------------
-- 7. Covering indexes for foreign keys
--    Deliberately NOT indexed: characters.game_id and game_accounts.game_id.
--    `games` is a reference table whose rows are never deleted, so those
--    indexes would cost writes and return nothing.
-- -----------------------------------------------------------------------------
create index if not exists idx_lodges_created_by
  on public.lodges(created_by);

create index if not exists idx_events_created_by
  on public.events(created_by);

create index if not exists idx_event_attendees_profile
  on public.event_attendees(profile_id);

create index if not exists idx_event_attendees_character
  on public.event_attendees(character_id);

create index if not exists idx_achievements_created_by
  on public.achievements(created_by);

create index if not exists idx_achievements_character
  on public.achievements(character_id);

create index if not exists idx_chronicle_entries_author
  on public.chronicle_entries(author_id);

create index if not exists idx_resource_links_created_by
  on public.resource_links(created_by);

create index if not exists idx_audit_events_actor
  on public.audit_events(actor_id);
