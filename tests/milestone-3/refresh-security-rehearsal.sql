-- DISPOSABLE lanternmere-security-test ONLY. Execute the entire file; all changes roll back.
-- Requires the pre-security-migration baseline. Never run on original Lanternmere.
BEGIN;
SAVEPOINT before_rehearsal;
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

-- Successful imports remain in character_snapshots. Failures never overwrite them.
create table public.character_refresh_failures (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  attempted_at timestamptz not null,
  failure_code text not null check (failure_code in (
    'authentication', 'unavailable', 'throttled', 'integration', 'save'
  )),
  created_at timestamptz not null default now(),
  check (isfinite(attempted_at))
);

create index idx_character_refresh_failures_latest
  on public.character_refresh_failures(character_id, attempted_at desc);

alter table public.character_refresh_failures enable row level security;
revoke all on public.character_refresh_failures from public, anon, authenticated;
grant select on public.character_refresh_failures to authenticated;
grant select, insert on public.character_refresh_failures to service_role;

create policy "character_refresh_failures_read_visible_character"
  on public.character_refresh_failures for select to authenticated
  using (private.can_read_character(character_id));

-- No ordinary-client write policy/grant. The server verifies ownership before
-- inserting a failure; neither owner IDs nor trusted outcomes come from a form.

-- Included after the pending migration inside the rehearsal transaction.
-- All helpers are SECURITY INVOKER so tests use the active role's privileges.
create temporary table lm_fixture (name text primary key, id uuid not null);
insert into lm_fixture select name, gen_random_uuid()
from unnest(array['alice','bob','outsider','lodge_a','lodge_b','missing']) name;
grant select on lm_fixture to anon, authenticated, service_role;

create function pg_temp.fixture(p_name text) returns uuid
language sql security invoker as $$
  select id from pg_temp.lm_fixture where name = p_name
$$;
create function pg_temp.check_true(p_ok boolean, p_label text) returns void
language plpgsql security invoker as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'PASS: %', p_label;
end $$;
create function pg_temp.expect_error(p_sql text, p_state text, p_label text)
returns void language plpgsql security invoker as $$
declare caught text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics caught = returned_sqlstate;
  end;
  if caught is distinct from p_state then
    raise exception 'FAIL: %; expected %, got %', p_label, p_state,
      coalesce(caught, 'success');
  end if;
  raise notice 'PASS: %', p_label;
end $$;
create function pg_temp.profile(p_name text, p_level integer default 80)
returns jsonb language sql security invoker as $$
  select jsonb_build_object('name', p_name, 'level', p_level,
    'realm', jsonb_build_object('slug', 'regression-realm'),
    'character_class', jsonb_build_object('name', 'Mage'),
    'faction', jsonb_build_object('name', 'Alliance'))
$$;

-- Throwaway auth rows trigger creation of matching public.profiles.
insert into auth.users (id, email, raw_user_meta_data)
select id, id::text || '@example.invalid', jsonb_build_object('display_name', name)
from lm_fixture where name in ('alice','bob','outsider');
insert into public.lodges (id, name, slug, created_by) values
(pg_temp.fixture('lodge_a'), 'Regression A', pg_temp.fixture('lodge_a')::text, pg_temp.fixture('alice')),
(pg_temp.fixture('lodge_b'), 'Regression B', pg_temp.fixture('lodge_b')::text, pg_temp.fixture('bob'));
insert into public.lodge_members (lodge_id, profile_id, role) values
(pg_temp.fixture('lodge_a'), pg_temp.fixture('alice'), 'owner'),
(pg_temp.fixture('lodge_a'), pg_temp.fixture('bob'), 'member'),
(pg_temp.fixture('lodge_b'), pg_temp.fixture('bob'), 'owner');

select pg_temp.check_true(to_regprocedure('public.save_wow_character(text,jsonb,timestamptz)') is null,
  'old untrusted import endpoint removed');
select pg_temp.check_true((select not p.prosecdef and p.proconfig @> array['search_path=""']
  from pg_proc p where p.oid = 'public.save_verified_wow_character(uuid,text,jsonb,timestamptz)'::regprocedure),
  'trusted import is invoker with empty search path');
select pg_temp.check_true((select p.prosecdef and p.proconfig @> array['search_path=""']
  from pg_proc p where p.oid = 'public.set_character_lodge_sharing(uuid,uuid[])'::regprocedure),
  'sharing definer retains empty search path');

-- Check table AND column grants; earlier migrations granted individual columns.
do $$
declare r text; t text; op text;
begin
  foreach r in array array['anon','authenticated'] loop
    foreach t in array array['characters','character_snapshots'] loop
      foreach op in array array['INSERT','UPDATE','DELETE'] loop
        perform pg_temp.check_true(not has_table_privilege(r, 'public.' || t, op),
          r || ' lacks table ' || op || ' on ' || t);
      end loop;
      foreach op in array array['INSERT','UPDATE'] loop
        perform pg_temp.check_true(not has_any_column_privilege(r, 'public.' || t, op),
          r || ' lacks column ' || op || ' on ' || t);
      end loop;
    end loop;
    perform pg_temp.check_true(not has_function_privilege(r,
      'public.save_verified_wow_character(uuid,text,jsonb,timestamptz)', 'EXECUTE'),
      r || ' cannot execute trusted import');
  end loop;
end $$;

select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Forbidden'),now())$q$,
  '42501', 'function body rejects even postgres when not service_role');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.check_true(auth.uid() is null, 'service import has no user session');
select public.save_verified_wow_character(pg_temp.fixture('alice'), 'us', pg_temp.profile('First'), now());
select public.save_verified_wow_character(pg_temp.fixture('alice'), 'us', pg_temp.profile('Second'), now());
select public.save_verified_wow_character(pg_temp.fixture('bob'), 'us', pg_temp.profile('Bobchar'), now());
reset role;
insert into lm_fixture
select character_name, id from public.characters
where profile_id in (pg_temp.fixture('alice'), pg_temp.fixture('bob'));
select pg_temp.check_true((select is_main from public.characters where id = pg_temp.fixture('first')),
  'first import becomes Main');
select pg_temp.check_true((select not is_main from public.characters where id = pg_temp.fixture('second')),
  'second import becomes alternate');

-- Denials must be permission errors, not incidental constraint failures.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.fixture('alice'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', pg_temp.fixture('alice')::text, true);
select pg_temp.check_true(auth.uid() = pg_temp.fixture('alice'), 'Alice identity configured');
select pg_temp.check_true((select count(*) = 2 from public.characters
  where profile_id in (pg_temp.fixture('alice'), pg_temp.fixture('bob'))), 'owner sees own characters only before sharing');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'), 'us', pg_temp.profile('Forged'), now())$q$, '42501', 'owner cannot call trusted import');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('bob'), 'us', pg_temp.profile('Forged'), now())$q$, '42501', 'cannot import for another user');
select pg_temp.expect_error($q$insert into public.characters (profile_id,game_id,region,realm_slug,character_name,class,faction,level)
  select pg_temp.fixture('alice'),id,'us','regression-realm','forged','Mage','Alliance',80 from public.games where slug='wow'$q$, '42501', 'direct character insert denied');
select pg_temp.expect_error($q$update public.characters set level=999 where id=pg_temp.fixture('first')$q$, '42501', 'official field forgery denied');
select pg_temp.expect_error($q$update public.characters set profile_id=pg_temp.fixture('bob') where id=pg_temp.fixture('first')$q$, '42501', 'ownership reassignment denied');
select pg_temp.expect_error($q$update public.characters set is_main=true where id=pg_temp.fixture('second')$q$, '42501', 'direct Main change denied');
select pg_temp.expect_error($q$delete from public.characters where id=pg_temp.fixture('second')$q$, '42501', 'alternate deletion denied');
select pg_temp.expect_error($q$insert into public.character_snapshots(character_id,snapshot_data,source) values(pg_temp.fixture('first'),'{}','blizzard')$q$, '42501', 'snapshot forgery denied');
select pg_temp.expect_error($q$update public.character_snapshots set snapshot_data='{}' where character_id=pg_temp.fixture('first')$q$, '42501', 'snapshot edit denied');
select pg_temp.expect_error($q$delete from public.character_snapshots where character_id=pg_temp.fixture('first')$q$, '42501', 'snapshot deletion denied');

select public.set_main_character(pg_temp.fixture('second'));
select public.set_main_character(pg_temp.fixture('second'));
select pg_temp.check_true((select count(*)=1 and bool_and(id=pg_temp.fixture('second'))
  from public.characters where profile_id=pg_temp.fixture('alice') and is_main), 'Main switch succeeds and is idempotent');
select pg_temp.expect_error($q$select public.set_main_character(pg_temp.fixture('bobchar'))$q$, '42501', 'cross-user Main switch denied');
select pg_temp.expect_error($q$select public.set_main_character(pg_temp.fixture('missing'))$q$, '42501', 'missing Main target denied');

select public.set_character_lodge_sharing(pg_temp.fixture('first'), array[pg_temp.fixture('lodge_a'),pg_temp.fixture('lodge_a')]);
select pg_temp.check_true((select count(*)=1 from public.character_lodges where character_id=pg_temp.fixture('first')),
  'owner shares to joined Lodge and duplicates are deduplicated');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('first'), array[pg_temp.fixture('lodge_a'),pg_temp.fixture('lodge_b')])$q$, '42501', 'mixed authorized and unauthorized Lodges rejected');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('bobchar'), '{}'::uuid[])$q$, '42501', 'cross-user sharing denied');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('missing'), '{}'::uuid[])$q$, '42501', 'missing character sharing denied');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('first'), null)$q$, '22023', 'null sharing list rejected');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('first'), array[null]::uuid[])$q$, '22023', 'null Lodge rejected');
select pg_temp.check_true((select count(*)=1 and bool_and(lodge_id=pg_temp.fixture('lodge_a'))
  from public.character_lodges where character_id=pg_temp.fixture('first')), 'failed sharing requests preserve prior selection');

-- Bob belongs to the selected Lodge, but cannot see Alice's unshared alternate.
select set_config('request.jwt.claims', jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=1 from public.characters where profile_id=pg_temp.fixture('alice')), 'Lodgemate sees only selected character');
select pg_temp.check_true((select count(*)=1 from public.character_snapshots where character_id in (pg_temp.fixture('first'),pg_temp.fixture('second'))), 'snapshot visibility matches character sharing');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('first'), '{}'::uuid[])$q$, '42501', 'Lodgemate cannot unshare another user character');
select pg_temp.expect_error($q$select public.set_main_character(pg_temp.fixture('first'))$q$, '42501', 'visible shared character cannot become another user Main');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('outsider'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('outsider')::text,true);
select pg_temp.check_true((select count(*)=0 from public.characters where profile_id in (pg_temp.fixture('alice'),pg_temp.fixture('bob'))), 'outsider sees no fixture characters');
select pg_temp.check_true((select count(*)=0 from public.character_snapshots where character_id in (pg_temp.fixture('first'),pg_temp.fixture('second'),pg_temp.fixture('bobchar'))), 'outsider sees no fixture snapshots');
reset role;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_true((select count(*)=0 from public.characters where profile_id in (pg_temp.fixture('alice'),pg_temp.fixture('bob'))), 'anon sees no fixture characters');
select pg_temp.check_true((select count(*)=0 from public.character_snapshots where character_id in (pg_temp.fixture('first'),pg_temp.fixture('second'),pg_temp.fixture('bobchar'))), 'anon sees no fixture snapshots');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Forged'),now())$q$,'42501','anon import denied');
select pg_temp.expect_error($q$select public.set_main_character(pg_temp.fixture('first'))$q$,'42501','anon Main switch denied');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('first'),'{}'::uuid[])$q$,'42501','anon sharing denied');
reset role;

-- Refresh must keep the same row, Main choice, and sharing while adding a snapshot.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_true(public.save_verified_wow_character(pg_temp.fixture('alice'),' US ',pg_temp.profile('FIRST',81),now())=pg_temp.fixture('first'), 'normalized refresh preserves character ID');
select pg_temp.check_true((select level=81 and not is_main from public.characters where id=pg_temp.fixture('first')), 'refresh updates official fields and preserves alternate');
select pg_temp.check_true(public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Second',82),now())=pg_temp.fixture('second'), 'Main refresh preserves ID');
select pg_temp.check_true((select is_main from public.characters where id=pg_temp.fixture('second')), 'refresh preserves Main');
select pg_temp.check_true((select count(*)=2 from public.character_snapshots where character_id=pg_temp.fixture('first')), 'refresh appends snapshot');
select pg_temp.check_true((select count(*)=1 from public.character_lodges where character_id=pg_temp.fixture('first')), 'refresh preserves sharing');
select pg_temp.expect_error($q$select public.save_verified_wow_character(null,'us',pg_temp.profile('Invalid'),now())$q$,'42501','missing owner rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('missing'),'us',pg_temp.profile('Invalid'),now())$q$,'23503','nonexistent owner rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'invalid',pg_temp.profile('Invalid'),now())$q$,'22023','invalid region rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us','{}',now())$q$,'22023','malformed profile rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Invalid',-1),now())$q$,'22023','negative level rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Invalid'),null)$q$,'22023','null timestamp rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Invalid'),'infinity')$q$,'22023','infinite timestamp rejected');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('Invalid'),now()+interval '1 day')$q$,'22023','future timestamp rejected');
reset role;

-- Inject a failure AFTER character upsert to prove snapshot/save atomicity.
-- The fixture-scoped trigger itself is rolled back with the transaction.
create function pg_temp.reject_fixture_snapshot() returns trigger language plpgsql as $$
begin
  if new.snapshot_data ->> 'name' in ('AtomicFailure','First') and exists (select 1 from public.characters where id=new.character_id and profile_id=pg_temp.fixture('alice')) then
    raise exception 'Intentional regression-test failure' using errcode='23514';
  end if;
  return new;
end $$;
create trigger lm_regression_snapshot_failure before insert on public.character_snapshots
for each row execute function pg_temp.reject_fixture_snapshot();
set local role service_role;
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('AtomicFailure'),now())$q$,'23514','new import rolls back on snapshot failure');
select pg_temp.expect_error($q$select public.save_verified_wow_character(pg_temp.fixture('alice'),'us',pg_temp.profile('First',999),now())$q$,'23514','refresh rolls back on snapshot failure');
select pg_temp.check_true((select count(*)=2 from public.characters where profile_id=pg_temp.fixture('alice')), 'failed import leaves no character');
select pg_temp.check_true((select level=81 from public.characters where id=pg_temp.fixture('first')), 'failed refresh restores prior official fields');
select pg_temp.check_true((select count(*)=2 from public.character_snapshots where character_id=pg_temp.fixture('first')), 'failed saves leave no extra snapshot');
reset role;
drop trigger lm_regression_snapshot_failure on public.character_snapshots;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select public.set_character_lodge_sharing(pg_temp.fixture('first'),'{}'::uuid[]);
select pg_temp.check_true((select count(*)=0 from public.character_lodges where character_id=pg_temp.fixture('first')), 'empty list removes all sharing');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=0 from public.characters where profile_id=pg_temp.fixture('alice')), 'unsharing removes Lodgemate character access');
select pg_temp.check_true((select count(*)=0 from public.character_snapshots where character_id=pg_temp.fixture('first')), 'unsharing removes snapshot access');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error($q$select public.set_main_character(pg_temp.fixture('first'))$q$,'42501','authenticated role without user identity cannot switch Main');
select pg_temp.expect_error($q$select public.set_character_lodge_sharing(pg_temp.fixture('first'),'{}'::uuid[])$q$,'42501','authenticated role without user identity cannot share');
reset role;
select pg_temp.check_true((select count(*)=1 from public.characters where profile_id=pg_temp.fixture('alice') and is_main), 'exactly one Main remains');


-- Run only after the Milestone 2 regression body, inside a rollback transaction.
select pg_temp.check_true((select relrowsecurity from pg_class where oid='public.character_refresh_failures'::regclass), 'failure RLS enabled');
select pg_temp.check_true(not has_table_privilege('anon','public.character_refresh_failures','SELECT'), 'anonymous failure reads denied');
do $$ declare r text; op text; begin
  foreach r in array array['anon','authenticated'] loop
    foreach op in array array['INSERT','UPDATE','DELETE'] loop
      perform pg_temp.check_true(not has_table_privilege(r,'public.character_refresh_failures',op), r || ' failure ' || op || ' denied');
    end loop;
  end loop;
end $$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
insert into public.character_refresh_failures(character_id,attempted_at,failure_code)
values(pg_temp.fixture('first'),now(),'throttled');
select pg_temp.check_true((select count(*)=1 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'trusted failure insertion works');
select pg_temp.check_true((select count(*)=2 from public.character_snapshots where character_id=pg_temp.fixture('first')), 'failure preserves snapshots');
select pg_temp.expect_error($q$insert into public.character_refresh_failures(character_id,attempted_at,failure_code) values(pg_temp.fixture('first'),now(),'raw-secret-error')$q$,'23514','failure codes restricted');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select pg_temp.check_true((select count(*)=1 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'owner reads failure');
select pg_temp.expect_error($q$insert into public.character_refresh_failures(character_id,attempted_at,failure_code) values(pg_temp.fixture('first'),now(),'save')$q$,'42501','owner cannot forge failure');
select pg_temp.expect_error($q$update public.character_refresh_failures set failure_code='save' where character_id=pg_temp.fixture('first')$q$,'42501','owner cannot change failure');
select pg_temp.expect_error($q$delete from public.character_refresh_failures where character_id=pg_temp.fixture('first')$q$,'42501','owner cannot delete failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=0 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'unshared Lodgemate cannot read failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select public.set_character_lodge_sharing(pg_temp.fixture('first'),array[pg_temp.fixture('lodge_a')]);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=1 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'selected Lodge member reads failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('outsider'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('outsider')::text,true);
select pg_temp.check_true((select count(*)=0 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'outsider cannot read failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select public.set_character_lodge_sharing(pg_temp.fixture('first'),'{}'::uuid[]);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=0 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'unsharing removes failure visibility');
reset role;

ROLLBACK TO SAVEPOINT before_rehearsal;
DO $$ BEGIN IF to_regclass('public.character_refresh_failures') IS NOT NULL OR to_regprocedure('public.save_verified_wow_character(uuid,text,jsonb,timestamptz)') IS NOT NULL THEN RAISE EXCEPTION 'Rollback failed'; END IF; END $$;
ROLLBACK;
SELECT 'REFRESH SECURITY REHEARSAL PASSED AND ROLLED BACK' AS result;
