-- Synthetic current-schema assertions. Run after the migration inside BEGIN/ROLLBACK.
select set_config('audit.m6_leader', gen_random_uuid()::text, true);
select set_config('audit.m6_traveler', gen_random_uuid()::text, true);
select set_config('audit.m6_member', gen_random_uuid()::text, true);
select set_config('audit.m6_lodge', gen_random_uuid()::text, true);
select set_config('audit.m6_character', gen_random_uuid()::text, true);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  (current_setting('audit.m6_leader')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm6-leader-' || current_setting('audit.m6_leader') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditLeader"}'::jsonb),
  (current_setting('audit.m6_traveler')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm6-traveler-' || current_setting('audit.m6_traveler') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditTraveler"}'::jsonb),
  (current_setting('audit.m6_member')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm6-member-' || current_setting('audit.m6_member') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditMember"}'::jsonb);
insert into public.lodges (id, name, slug, created_by)
values (current_setting('audit.m6_lodge')::uuid, 'M6 Audit Lodge',
  'm6-' || current_setting('audit.m6_lodge'), current_setting('audit.m6_leader')::uuid);
insert into public.lodge_members (lodge_id, profile_id, role)
values
  (current_setting('audit.m6_lodge')::uuid, current_setting('audit.m6_leader')::uuid, 'owner'),
  (current_setting('audit.m6_lodge')::uuid, current_setting('audit.m6_traveler')::uuid, 'member'),
  (current_setting('audit.m6_lodge')::uuid, current_setting('audit.m6_member')::uuid, 'member');
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select current_setting('audit.m6_character')::uuid, current_setting('audit.m6_traveler')::uuid,
  game.id, 'us', 'stormrage', 'Audittraveler' from public.games game where game.slug = 'wow';
insert into public.character_raiderio_sharing (character_id, lodge_id)
values (current_setting('audit.m6_character')::uuid, current_setting('audit.m6_lodge')::uuid);
insert into public.character_raiderio_snapshots
  (character_id, character_name, realm_slug, region, mythic_plus_score,
   raid_progression, source_url, refreshed_at)
values
  (current_setting('audit.m6_character')::uuid, 'Audittraveler', 'stormrage', 'us', 1234,
   '{"private":"detail"}'::jsonb, 'https://raider.io/characters/us/stormrage/Audittraveler', now());
insert into public.character_raidbots_reports
  (character_id, lodge_id, character_name, realm_slug, region, report_url, upgrade_targets)
values
  (current_setting('audit.m6_character')::uuid, current_setting('audit.m6_lodge')::uuid,
   'Audittraveler', 'stormrage', 'us', 'https://www.raidbots.com/simbot/report/audit', 'A player note');

do $$
begin
  if has_column_privilege('authenticated', 'public.character_raiderio_snapshots', 'raid_progression', 'SELECT')
    or has_function_privilege('authenticated', 'public.claim_raiderio_refresh(uuid)', 'EXECUTE')
  then raise exception 'Sensitive progression or refresh claim is exposed to clients'; end if;
  begin
    update public.character_raidbots_reports set upgrade_targets = repeat('x', 501)
    where character_id = current_setting('audit.m6_character')::uuid;
    raise exception 'Oversized Raidbots target was accepted';
  exception when check_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m6_member'), true);
do $$
begin
  if (select count(character_id) from public.character_raiderio_snapshots) <> 0
    or (select count(character_id) from public.character_raiderio_refresh_attempts) <> 0
    or (select count(character_id) from public.character_raidbots_reports) <> 0
  then raise exception 'Plain Lodge member can read leader-only readiness'; end if;
end;
$$;
reset role;

set role service_role;
do $$
begin
  if not public.claim_raiderio_refresh(current_setting('audit.m6_character')::uuid)
    or public.claim_raiderio_refresh(current_setting('audit.m6_character')::uuid)
  then raise exception 'Raider.IO attempt claim did not enforce the cooldown'; end if;
end;
$$;
update public.character_raiderio_refresh_attempts
set failure_message = 'Raider.IO is busy. Please wait and try again later.'
where character_id = current_setting('audit.m6_character')::uuid;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m6_leader'), true);
do $$
begin
  perform snapshot.character_name, snapshot.realm_slug, snapshot.region,
    snapshot.mythic_plus_score, snapshot.source_url, snapshot.refreshed_at,
    snapshot.failure_message
  from public.character_raiderio_snapshots snapshot
  where snapshot.character_id = current_setting('audit.m6_character')::uuid;
  if (select count(character_id) from public.character_raiderio_snapshots) <> 1
    or (select count(character_id) from public.character_raiderio_refresh_attempts
        where failure_message is not null) <> 1
    or (select count(character_id) from public.character_raidbots_reports) <> 1
  then raise exception 'Leader cannot read consented readiness and safe failure'; end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m6_traveler'), true);
do $$
begin
  if (select count(character_id) from public.character_raiderio_snapshots) <> 1
    or (select count(character_id) from public.character_raiderio_refresh_attempts) <> 1
    or (select count(character_id) from public.character_raidbots_reports) <> 1
  then raise exception 'Traveler cannot read their own progress'; end if;
end;
$$;
reset role;

delete from public.character_raiderio_sharing
where character_id = current_setting('audit.m6_character')::uuid
  and lodge_id = current_setting('audit.m6_lodge')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m6_leader'), true);
do $$
begin
  if (select count(character_id) from public.character_raiderio_snapshots) <> 0
    or (select count(character_id) from public.character_raiderio_refresh_attempts) <> 0
  then raise exception 'Revoked Raider.IO sharing still exposes readiness'; end if;
end;
$$;
reset role;

update public.character_raiderio_refresh_attempts
set attempted_at = now() - interval '25 hours'
where character_id = current_setting('audit.m6_character')::uuid;
set role service_role;
do $$
begin
  if not public.claim_raiderio_refresh(current_setting('audit.m6_character')::uuid)
  then raise exception 'Raider.IO cooldown did not expire'; end if;
end;
$$;
reset role;
