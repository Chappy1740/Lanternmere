-- ONLY run in the empty lanternmere-security-test project.
-- Existing schema through 20260915014220; pending security migration EXCLUDED.
-- No real user data or credentials are included.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     OR to_regclass('public.characters') IS NOT NULL
     OR to_regclass('public.lodges') IS NOT NULL THEN
    RAISE EXCEPTION 'Expected an empty test project. Stop: existing Lanternmere tables found.';
  END IF;
END $$;
-- SOURCE: 0001_initial_schema.sql
-- =============================================================================
-- Lanternmere — Initial Schema Migration
-- Milestone 1: profiles, lodges, membership, games, characters, events,
-- achievements, chronicles, resources, audit log — with RLS on every
-- user-facing table.
--
-- Run via: npx supabase db push
--
-- Design notes (read before editing):
--
--   1. Lodge creation goes through public.create_lodge(), NOT a direct insert.
--      A plain insert cannot work here: the SELECT policy on lodges requires an
--      existing membership row, but PostgreSQL evaluates INSERT ... RETURNING
--      visibility BEFORE AFTER-row triggers fire. Creating the lodge and the
--      owner membership inside one SECURITY DEFINER function makes the
--      operation atomic and returnable.
--
--   2. Every policy wraps auth.uid() as (select auth.uid()). PostgreSQL then
--      evaluates it once per statement (an InitPlan) instead of once per row.
--      On a 10,000-row scan that is the difference between 1 call and 10,000.
--
--   3. Membership lookups inside policies go through SECURITY DEFINER helper
--      functions. Querying lodge_members directly from a policy would re-apply
--      that table's own RLS, nesting policy evaluation inside policy
--      evaluation. The helpers run with the definer's rights, so evaluation
--      stays flat and predictable.
--
--   4. Those helpers live in the `private` schema, which is NOT exposed through
--      PostgREST. They must keep EXECUTE for anon/authenticated — an RLS policy
--      is evaluated with the querying user's privileges, so revoking EXECUTE
--      breaks the policy itself — but because the schema is unexposed there is
--      no /rest/v1/rpc/ endpoint for them. public.create_lodge() is the only
--      function deliberately published as an API.
--
--   5. Every function sets `search_path = ''` and fully qualifies its
--      references. An unset search_path on a SECURITY DEFINER function is a
--      privilege-escalation vector: a caller can point an unqualified name at
--      an object they control.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schemas and extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;

create schema if not exists private;
grant usage on schema private to postgres, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Reusable trigger: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- slugify — deterministic URL-safe identifier from a display name
-- -----------------------------------------------------------------------------
create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- =============================================================================
-- 1. profiles — one row per auth.users row
-- =============================================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- =============================================================================
-- 2. lodges + lodge_members
-- =============================================================================
create table public.lodges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_lodges_updated_at
  before update on public.lodges
  for each row execute function private.set_updated_at();

create table public.lodge_members (
  id         uuid primary key default gen_random_uuid(),
  lodge_id   uuid not null references public.lodges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'caretaker', 'member', 'guest')),
  joined_at  timestamptz not null default now(),
  unique (lodge_id, profile_id)
);

create index idx_lodge_members_profile on public.lodge_members(profile_id);
create index idx_lodge_members_lodge on public.lodge_members(lodge_id);

-- -----------------------------------------------------------------------------
-- RLS helper functions — SECURITY DEFINER, unexposed schema
-- -----------------------------------------------------------------------------
create or replace function private.is_lodge_member(p_lodge_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.lodge_members
    where lodge_id = p_lodge_id and profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_lodge_admin(p_lodge_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.lodge_members
    where lodge_id = p_lodge_id
      and profile_id = (select auth.uid())
      and role in ('owner', 'caretaker')
  );
$$;

create or replace function private.is_lodge_owner(p_lodge_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.lodge_members
    where lodge_id = p_lodge_id
      and profile_id = (select auth.uid())
      and role = 'owner'
  );
$$;

-- True when the current user shares at least one Lodge with p_profile_id.
create or replace function private.shares_lodge_with(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.lodge_members lm_self
    join public.lodge_members lm_other on lm_other.lodge_id = lm_self.lodge_id
    where lm_self.profile_id = (select auth.uid())
      and lm_other.profile_id = p_profile_id
  );
$$;

-- =============================================================================
-- 3. games — small reference table, publicly readable
-- =============================================================================
create table public.games (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique, -- 'wow'
  name       text not null,
  created_at timestamptz not null default now()
);

insert into public.games (slug, name) values ('wow', 'World of Warcraft');

-- =============================================================================
-- 4. game_accounts / game_account_tokens — split for token isolation
-- =============================================================================
create table public.game_accounts (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  game_id      uuid not null references public.games(id),
  region       text not null,
  battle_tag   text,
  connected_at timestamptz not null default now(),
  unique (profile_id, game_id)
);

-- Tokens live in their own table with RLS enabled and NO policies.
-- That means even the owning user's authenticated JWT cannot select/insert/update
-- this table through PostgREST — only the service-role key (server actions) can.
create table public.game_account_tokens (
  game_account_id uuid primary key references public.game_accounts(id) on delete cascade,
  access_token     text not null,
  refresh_token    text,
  expires_at       timestamptz not null,
  updated_at       timestamptz not null default now()
);

create trigger trg_tokens_updated_at
  before update on public.game_account_tokens
  for each row execute function private.set_updated_at();

-- =============================================================================
-- 5. characters + character_lodges + character_snapshots
-- =============================================================================
create table public.characters (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  game_id        uuid not null references public.games(id),
  region         text not null,
  realm_slug     text not null,
  character_name text not null,
  class          text,
  faction        text,
  level          int,
  is_main        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (profile_id, game_id, region, realm_slug, character_name)
);

create index idx_characters_profile on public.characters(profile_id);

create trigger trg_characters_updated_at
  before update on public.characters
  for each row execute function private.set_updated_at();

-- Explicit character <-> lodge sharing relationship. A character belongs to a
-- user, not to a Lodge, so sharing is an opt-in join row rather than a column.
create table public.character_lodges (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  lodge_id     uuid not null references public.lodges(id) on delete cascade,
  shared_at    timestamptz not null default now(),
  unique (character_id, lodge_id)
);

create index idx_character_lodges_lodge on public.character_lodges(lodge_id);

create table public.character_snapshots (
  id                uuid primary key default gen_random_uuid(),
  character_id      uuid not null references public.characters(id) on delete cascade,
  snapshot_data     jsonb not null,
  source            text not null, -- 'blizzard' | 'raiderio'
  last_refreshed_at timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_character_snapshots_character on public.character_snapshots(character_id);

-- =============================================================================
-- 6. events + event_attendees
-- =============================================================================
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  lodge_id      uuid not null references public.lodges(id) on delete cascade,
  created_by    uuid not null references public.profiles(id),
  title         text not null,
  activity_type text,
  event_date    date not null,
  event_time    time,
  difficulty    text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_events_lodge on public.events(lodge_id);

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create table public.event_attendees (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id),
  rsvp_status  text not null default 'tentative' check (rsvp_status in ('confirmed', 'tentative', 'declined')),
  role         text,
  unique (event_id, profile_id)
);

create index idx_event_attendees_event on public.event_attendees(event_id);

-- =============================================================================
-- 7. achievements
-- =============================================================================
create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  lodge_id     uuid not null references public.lodges(id) on delete cascade,
  character_id uuid references public.characters(id),
  created_by   uuid not null references public.profiles(id),
  title        text not null,
  description  text,
  achieved_at  timestamptz,
  source       text, -- 'blizzard' | 'manual'
  created_at   timestamptz not null default now()
);

create index idx_achievements_lodge on public.achievements(lodge_id);

-- =============================================================================
-- 8. chronicle_entries
-- =============================================================================
create table public.chronicle_entries (
  id         uuid primary key default gen_random_uuid(),
  lodge_id   uuid not null references public.lodges(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  title      text,
  body       text,
  image_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chronicle_entries_lodge on public.chronicle_entries(lodge_id);

create trigger trg_chronicle_updated_at
  before update on public.chronicle_entries
  for each row execute function private.set_updated_at();

-- =============================================================================
-- 9. resource_links
-- =============================================================================
create table public.resource_links (
  id         uuid primary key default gen_random_uuid(),
  lodge_id   uuid not null references public.lodges(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title      text not null,
  url        text not null,
  category   text,
  created_at timestamptz not null default now()
);

create index idx_resource_links_lodge on public.resource_links(lodge_id);

-- =============================================================================
-- 10. audit_events — admin-visible only, written by trusted server code
-- =============================================================================
create table public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  lodge_id     uuid references public.lodges(id) on delete cascade,
  actor_id     uuid references public.profiles(id),
  action       text not null,
  target_table text,
  target_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index idx_audit_events_lodge on public.audit_events(lodge_id);

-- =============================================================================
-- 11. create_lodge — the ONLY supported way to create a Lodge
-- =============================================================================
-- Creates the lodge, the owner membership row, and the audit entry as one
-- atomic unit, then returns the new lodge. SECURITY DEFINER lets it write the
-- membership row that the SELECT policy will later depend on; the explicit
-- auth.uid() check inside is what keeps it from being an authorization hole.
create or replace function public.create_lodge(
  p_name        text,
  p_description text default null
)
returns public.lodges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := (select auth.uid());
  v_base    text;
  v_slug    text;
  v_lodge   public.lodges;
  v_attempt int := 0;
begin
  if v_actor is null then
    raise exception 'create_lodge: authentication required'
      using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'create_lodge: a Lodge name is required'
      using errcode = '22023';
  end if;

  if length(btrim(p_name)) > 60 then
    raise exception 'create_lodge: Lodge name must be 60 characters or fewer'
      using errcode = '22023';
  end if;

  v_base := private.slugify(btrim(p_name));
  if v_base = '' then
    v_base := 'lodge';
  end if;
  v_slug := v_base;

  -- Retry on slug collision. Doing this in the database avoids the
  -- check-then-insert race two users hitting "Create Lodge" at once would cause.
  loop
    begin
      insert into public.lodges (name, slug, description, created_by)
      values (
        btrim(p_name),
        v_slug,
        nullif(btrim(coalesce(p_description, '')), ''),
        v_actor
      )
      returning * into v_lodge;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise exception 'create_lodge: could not generate a unique slug for "%"', p_name;
      end if;
      v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    end;
  end loop;

  insert into public.lodge_members (lodge_id, profile_id, role)
  values (v_lodge.id, v_actor, 'owner');

  insert into public.audit_events (lodge_id, actor_id, action, target_table, target_id)
  values (v_lodge.id, v_actor, 'lodge.created', 'lodges', v_lodge.id);

  return v_lodge;
end;
$$;

-- Published as an API endpoint for signed-in users only.
revoke all on function public.create_lodge(text, text) from public, anon;
grant execute on function public.create_lodge(text, text) to authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.lodges enable row level security;
alter table public.lodge_members enable row level security;
alter table public.games enable row level security;
alter table public.game_accounts enable row level security;
alter table public.game_account_tokens enable row level security; -- no policies: service-role only
alter table public.characters enable row level security;
alter table public.character_lodges enable row level security;
alter table public.character_snapshots enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.achievements enable row level security;
alter table public.chronicle_entries enable row level security;
alter table public.resource_links enable row level security;
alter table public.audit_events enable row level security;

-- ---- profiles ----
create policy "profiles_select_self_or_lodgemate" on public.profiles
  for select using (
    id = (select auth.uid())
    or private.shares_lodge_with(id)
  );

create policy "profiles_insert_self" on public.profiles
  for insert with check (id = (select auth.uid()));

create policy "profiles_update_self" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---- lodges ----
-- Deliberately NO insert policy. Lodges are created through create_lodge()
-- only, so there is no path that produces a lodge with no owner.
create policy "lodges_select_member" on public.lodges
  for select using (private.is_lodge_member(id));

create policy "lodges_update_admin" on public.lodges
  for update using (private.is_lodge_admin(id))
  with check (private.is_lodge_admin(id));

create policy "lodges_delete_owner" on public.lodges
  for delete using (private.is_lodge_owner(id));

revoke insert on public.lodges from authenticated, anon;

-- ---- lodge_members ----
create policy "lodge_members_select_member" on public.lodge_members
  for select using (private.is_lodge_member(lodge_id));

create policy "lodge_members_insert_admin" on public.lodge_members
  for insert with check (private.is_lodge_admin(lodge_id));

create policy "lodge_members_update_admin" on public.lodge_members
  for update using (private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_admin(lodge_id));

create policy "lodge_members_delete_admin_or_self" on public.lodge_members
  for delete using (private.is_lodge_admin(lodge_id) or profile_id = (select auth.uid()));

-- ---- games (public reference data) ----
create policy "games_select_all" on public.games
  for select using (true);
-- No insert/update/delete policy: only service role (migrations/seed) can write.

-- ---- game_accounts (no token columns here) ----
create policy "game_accounts_owner_all" on public.game_accounts
  for all using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- game_account_tokens: RLS enabled, zero policies -> denied for anon/authenticated.

-- ---- characters ----
create policy "characters_select_owner_or_lodgemate" on public.characters
  for select using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.character_lodges cl
      where cl.character_id = characters.id and private.is_lodge_member(cl.lodge_id)
    )
  );

create policy "characters_owner_write" on public.characters
  for all using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---- character_lodges ----
create policy "character_lodges_select_member" on public.character_lodges
  for select using (
    private.is_lodge_member(lodge_id)
    or exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
  );

create policy "character_lodges_insert_owner" on public.character_lodges
  for insert with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
    and private.is_lodge_member(lodge_id)
  );

create policy "character_lodges_delete_owner" on public.character_lodges
  for delete using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
  );

-- ---- character_snapshots ----
create policy "character_snapshots_select_owner_or_lodgemate" on public.character_snapshots
  for select using (
    exists (
      select 1 from public.characters c
      where c.id = character_id
        and (
          c.profile_id = (select auth.uid())
          or exists (
            select 1 from public.character_lodges cl
            where cl.character_id = c.id and private.is_lodge_member(cl.lodge_id)
          )
        )
    )
  );

create policy "character_snapshots_insert_owner" on public.character_snapshots
  for insert with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
  );

create policy "character_snapshots_update_owner" on public.character_snapshots
  for update using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.profile_id = (select auth.uid())
    )
  );

-- ---- events ----
create policy "events_select_member" on public.events
  for select using (private.is_lodge_member(lodge_id));

create policy "events_insert_member" on public.events
  for insert with check (
    private.is_lodge_member(lodge_id) and created_by = (select auth.uid())
  );

create policy "events_update_creator_or_admin" on public.events
  for update using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_member(lodge_id));

create policy "events_delete_creator_or_admin" on public.events
  for delete using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id));

-- ---- event_attendees ----
create policy "event_attendees_select_member" on public.event_attendees
  for select using (
    exists (select 1 from public.events e where e.id = event_id and private.is_lodge_member(e.lodge_id))
  );

create policy "event_attendees_insert_self" on public.event_attendees
  for insert with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and private.is_lodge_member(e.lodge_id))
  );

create policy "event_attendees_update_self" on public.event_attendees
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "event_attendees_delete_self_or_admin" on public.event_attendees
  for delete using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.events e where e.id = event_id and private.is_lodge_admin(e.lodge_id))
  );

-- ---- achievements ----
create policy "achievements_select_member" on public.achievements
  for select using (private.is_lodge_member(lodge_id));

create policy "achievements_insert_member" on public.achievements
  for insert with check (
    private.is_lodge_member(lodge_id) and created_by = (select auth.uid())
  );

create policy "achievements_update_creator_or_admin" on public.achievements
  for update using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_member(lodge_id));

create policy "achievements_delete_creator_or_admin" on public.achievements
  for delete using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id));

-- ---- chronicle_entries ----
create policy "chronicle_select_member" on public.chronicle_entries
  for select using (private.is_lodge_member(lodge_id));

create policy "chronicle_insert_member" on public.chronicle_entries
  for insert with check (
    private.is_lodge_member(lodge_id) and author_id = (select auth.uid())
  );

create policy "chronicle_update_author_or_admin" on public.chronicle_entries
  for update using (author_id = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_member(lodge_id));

create policy "chronicle_delete_author_or_admin" on public.chronicle_entries
  for delete using (author_id = (select auth.uid()) or private.is_lodge_admin(lodge_id));

-- ---- resource_links ----
create policy "resource_links_select_member" on public.resource_links
  for select using (private.is_lodge_member(lodge_id));

create policy "resource_links_insert_member" on public.resource_links
  for insert with check (
    private.is_lodge_member(lodge_id) and created_by = (select auth.uid())
  );

create policy "resource_links_update_creator_or_admin" on public.resource_links
  for update using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_member(lodge_id));

create policy "resource_links_delete_creator_or_admin" on public.resource_links
  for delete using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id));

-- ---- audit_events ----
create policy "audit_events_select_admin" on public.audit_events
  for select using (private.is_lodge_admin(lodge_id));
-- No insert policy: writes come from SECURITY DEFINER functions or server
-- actions using the service-role key.


-- SOURCE: 0002_policy_and_index_tuning.sql
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


-- SOURCE: 20260912143857_save_wow_character.sql
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

-- SOURCE: 20260913024228_enforce_one_main_character.sql
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

-- SOURCE: 20260915014220_set_character_lodge_sharing.sql
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

COMMIT;
SELECT 'Test baseline ready; pending security migration NOT applied.' AS result;