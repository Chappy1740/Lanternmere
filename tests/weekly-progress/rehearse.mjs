/* eslint-disable no-console -- Disposable in-memory PostgreSQL test runner. */
// This runner accepts a LOCAL PGlite module path, never a database URL.
// It creates a minimal dependency fixture in memory, loads the real existing
// authorization/consent SQL and exact pending migration, then runs assertions.
// It is not a complete Supabase current-schema or hosted/PostgREST rehearsal.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath || !modulePath.endsWith('.js'))
  throw new Error('Pass the local PGlite dist/index.js path. No database URLs accepted.');
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const db = new PGlite();
const sql = (name) => readFile(resolve('supabase/migrations', name), 'utf8');
async function realFunction(filename, name) {
  const source = await sql(filename);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(
    new RegExp(`create (?:or replace )?function ${escaped}\\([\\s\\S]*?\\$\\$;`, 'i'),
  );
  if (!match) throw new Error(`Missing real function ${name}`);
  return match[0];
}
async function realTable(filename, name) {
  const source = await sql(filename);
  const match = source.match(new RegExp(`create table public\\.${name} \\([\\s\\S]*?\\n\\);`, 'i'));
  if (!match) throw new Error(`Missing real table ${name}`);
  return match[0];
}
try {
  const engine = await db.query('show server_version');
  console.log(`In-memory PostgreSQL engine: ${engine.rows[0].server_version}`);
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema private;
    grant usage on schema public, auth, private to authenticated, anon, service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text,
      encrypted_password text, email_confirmed_at timestamptz, created_at timestamptz,
      updated_at timestamptz, raw_user_meta_data jsonb);
    create table public.profiles (id uuid primary key references auth.users(id), display_name text);
    create function private.fixture_profile() returns trigger language plpgsql as $$ begin
      insert into public.profiles values (new.id, new.raw_user_meta_data->>'display_name'); return new;
    end $$;
    create trigger fixture_profile after insert on auth.users for each row execute function private.fixture_profile();
    create table public.games (id uuid primary key default gen_random_uuid(), slug text unique);
    insert into public.games(slug) values ('wow');
    create table public.guilds (id uuid primary key default gen_random_uuid(), name text, slug text unique, created_by uuid references profiles);
    create table public.guild_members (id uuid primary key default gen_random_uuid(), guild_id uuid references guilds on delete cascade, profile_id uuid references profiles);
    create table public.guild_member_roles (guild_member_id uuid references guild_members on delete cascade, role text, granted_by uuid references profiles, granted_at timestamptz default now());
    create table public.guild_verified_claims (guild_id uuid primary key references guilds, profile_id uuid references profiles, blizzard_character_id bigint,
      region text, realm_slug text, guild_name text, claimed_at timestamptz, expires_at timestamptz);
    create table public.characters (id uuid primary key default gen_random_uuid(), profile_id uuid references profiles, game_id uuid references games,
      region text, realm_slug text, character_name text);
    create table public.character_guild_sharing (character_id uuid references characters on delete cascade, guild_id uuid references guilds on delete cascade,
      visibility text, primary key(character_id,guild_id));
    create table public.guild_audit_events (id uuid primary key default gen_random_uuid(), guild_id uuid references guilds, actor_id uuid references profiles,
      action text, target_table text, target_id uuid, metadata jsonb default '{}');
    create table public.app_account_access (profile_id uuid primary key references profiles, suspended boolean not null default false, updated_at timestamptz default now());
    grant select on public.characters, public.guild_members to authenticated;
  `);
  const foundation = '20260922043253_guild_foundation.sql';
  await db.exec(await realFunction('0001_initial_schema.sql', 'private.set_updated_at'));
  await db.exec(await realFunction(foundation, 'private.is_guild_member'));
  await db.exec(
    await realFunction('20260928190934_guild_verified_claim_gate.sql', 'private.has_guild_role'),
  );
  await db.exec(await realTable('0001_initial_schema.sql', 'lodges'));
  await db.exec(await realTable('0001_initial_schema.sql', 'events'));
  await db.exec(
    await realTable('20260923090723_guild_raid_operations.sql', 'guild_raid_operations'),
  );
  await db.exec(await realFunction(foundation, 'private.can_manage_guild'));
  await db.exec(await realFunction(foundation, 'private.can_lead_guild'));
  await db.exec(
    await realFunction(
      '20261002092258_account_access_management.sql',
      'private.app_account_active',
    ),
  );
  const weekly = await sql('20260930203229_weekly_vault_progress.sql');
  const split = weekly.indexOf('create function public.delete_guild_member_availability');
  assert.ok(split > 0, 'Current weekly-table source delimiter');
  await db.exec(weekly.slice(0, split));
  await db.exec(await sql('20261001013411_guild_vault_sharing.sql'));
  await db.exec(await sql('20261004173132_enforce_account_suspension_on_later_tables.sql'));
  // Mirror the real Traveler-sharing grant, RLS and select policy used by the leadership report policy.
  await db.exec(await realFunction('0002_policy_and_index_tuning.sql', 'private.owns_character'));
  const sharingPolicy = (await sql(foundation)).match(
    /create policy "character_guild_sharing_select_owner_or_scope"[\s\S]*?\n\);/,
  );
  assert.ok(sharingPolicy, 'Real Traveler-sharing select policy');
  await db.exec(`
    grant select on public.character_guild_sharing to authenticated;
    alter table public.character_guild_sharing enable row level security;
    ${sharingPolicy[0]}
  `);
  await db.exec(await sql('20261026184612_guild_weekly_raider_progress.sql'));
  console.log('Exact pending migration applied to disposable in-memory fixture.');
  const result = await db.exec(
    await readFile('tests/weekly-progress/permissions-rehearsal.sql', 'utf8'),
  );
  assert.match(JSON.stringify(result.at(-1).rows), /PASSED AND ROLLED BACK/);
  for (const table of [
    'auth.users',
    'public.guilds',
    'public.weekly_vault_progress',
    'public.guild_weekly_requirements',
    'public.lodges',
    'public.events',
    'public.guild_raid_operations',
  ]) {
    const count = await db.query(`select count(*)::int as total from ${table}`);
    assert.equal(count.rows[0].total, 0, `Fixture rollback: ${table}`);
  }
  console.log(
    'PostgreSQL role, ownership, consent, grants, validation and reset assertions passed; synthetic records rolled back.',
  );
  console.log(
    'LIMIT: minimal fixture, not full hosted Supabase/PostgREST, concurrent sessions or production acceptance.',
  );
} catch (error) {
  try {
    await db.exec('rollback');
  } catch {
    /* Closing discards the entire in-memory database. */
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
