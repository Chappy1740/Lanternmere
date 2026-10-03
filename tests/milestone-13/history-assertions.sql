-- Synthetic fixture body. The caller must wrap this in BEGIN ... ROLLBACK.
select set_config('audit.m13_owner', gen_random_uuid()::text, true);
select set_config('audit.m13_other', gen_random_uuid()::text, true);
select set_config('audit.m13_character', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm13-' || id || '@example.invalid', '', now(), now(), now(),
  jsonb_build_object('display_name', label)
from (values
  (current_setting('audit.m13_owner')::uuid, 'AuditOwner'),
  (current_setting('audit.m13_other')::uuid, 'AuditOther')
) as people(id, label);
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select current_setting('audit.m13_character')::uuid, current_setting('audit.m13_owner')::uuid,
  game.id, 'us', 'stormrage', 'AuditOwner'
from public.games game where game.slug = 'wow';
insert into public.character_raiderio_snapshots
  (character_id, character_name, realm_slug, region, mythic_plus_score,
    season_label, best_runs, raid_progression, source_url, refreshed_at)
values (current_setting('audit.m13_character')::uuid, 'AuditOwner', 'stormrage', 'us', 1900,
  'audit-season', '[{"dungeon":"Audit Vault","level":10,"score":250}]'::jsonb,
  '{"audit-raid":{"summary":"1/8 M"}}'::jsonb,
  'https://raider.io/characters/us/stormrage/AuditOwner', now() - interval '2 days');
update public.character_raiderio_snapshots set failure_message = 'Synthetic outage'
where character_id = current_setting('audit.m13_character')::uuid;
update public.character_raiderio_snapshots
set mythic_plus_score = 2000, best_runs = '[{"dungeon":"Audit Vault","level":11,"score":275}]'::jsonb,
  failure_message = null, refreshed_at = now() - interval '1 day'
where character_id = current_setting('audit.m13_character')::uuid;
do $$ begin
  if (select count(*) from public.character_raiderio_history
      where character_id = current_setting('audit.m13_character')::uuid) <> 2
  then raise exception 'History capture or failed-refresh boundary failed'; end if;
  if (select count(*) from public.character_raiderio_history
      where character_id = current_setting('audit.m13_character')::uuid
        and season_label = 'audit-season' and best_runs @> '[{"dungeon":"Audit Vault"}]'::jsonb) <> 2
  then raise exception 'Season and dungeon context was not captured'; end if;
  if has_table_privilege('authenticated', 'public.character_raiderio_history', 'insert')
    or has_table_privilege('authenticated', 'public.character_raiderio_history', 'update')
  then raise exception 'History direct-write boundary failed'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m13_other'), true);
do $$ begin
  if exists (select 1 from public.character_raiderio_history
      where character_id = current_setting('audit.m13_character')::uuid)
  then raise exception 'Other account saw owner history'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('audit.m13_owner'), true);
do $$ begin
  if (select count(*) from public.character_raiderio_history
      where character_id = current_setting('audit.m13_character')::uuid) <> 2
  then raise exception 'Owner could not read history'; end if;
end $$;
reset role;
delete from public.characters where id = current_setting('audit.m13_character')::uuid;
do $$ begin
  if exists (select 1 from public.character_raiderio_history
      where character_id = current_setting('audit.m13_character')::uuid)
  then raise exception 'Character deletion did not clear history'; end if;
end $$;
select 'Milestone 13 synthetic history checks passed (transaction must roll back)' as result;
