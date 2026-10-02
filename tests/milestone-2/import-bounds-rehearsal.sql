-- Run against the current schema only. All synthetic rows are rolled back.
begin;

do $$
declare v_profile uuid := gen_random_uuid(); v_character uuid := gen_random_uuid(); v_game uuid;
begin
  select id into v_game from public.games where slug = 'wow';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  values (v_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2-import-' || v_profile || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditImport"}'::jsonb);
  insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
  values (v_character, v_profile, v_game, 'us', 'stormrage', 'Auditimport');
  perform set_config('m2.profile_id', v_profile::text, true);
  perform set_config('m2.character_id', v_character::text, true);
end;
$$;

do $$ begin
  if has_function_privilege('authenticated', 'public.claim_wow_profile_fetch(uuid,text,text,text)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.wow_profile_fetch_limits', 'SELECT')
    or has_table_privilege('authenticated', 'public.wow_profile_fetch_limits', 'INSERT')
  then raise exception 'ordinary client can access trusted cooldown'; end if;
end $$;

set role service_role;
do $$
declare v_profile uuid := current_setting('m2.profile_id')::uuid;
begin
  if not public.claim_wow_profile_fetch(v_profile, 'us', 'stormrage', 'auditimport')
    then raise exception 'first profile fetch was denied'; end if;
  if public.claim_wow_profile_fetch(v_profile, 'us', 'stormrage', 'auditimport')
    then raise exception 'cooldown allowed immediate repeat'; end if;
end;
$$;
reset role;

update public.wow_profile_fetch_limits set attempted_at = now() - interval '6 minutes'
where profile_id = current_setting('m2.profile_id')::uuid;
set role service_role;
do $$ begin
  if not public.claim_wow_profile_fetch(current_setting('m2.profile_id')::uuid, 'us', 'stormrage', 'auditimport')
    then raise exception 'cooldown did not expire'; end if;
end $$;
reset role;

insert into public.character_snapshots (character_id, snapshot_data, source, last_refreshed_at)
select current_setting('m2.character_id')::uuid, '{}'::jsonb, 'blizzard', now() + n * interval '1 second'
from generate_series(1, 12) as n;
do $$ begin
  if (select count(*) from public.character_snapshots
      where character_id = current_setting('m2.character_id')::uuid and source = 'blizzard') <> 10
    then raise exception 'snapshot history was not limited to ten'; end if;
end $$;

rollback;
select 'M2 IMPORT BOUNDS PASSED AND ROLLED BACK' as result;
