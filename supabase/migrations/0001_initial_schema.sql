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
