-- Run ONLY on a disposable current-schema database after the pending migration.
-- Synthetic accounts and records only. The whole fixture rolls back.
begin;
select set_config('audit.weekly_leader', gen_random_uuid()::text, true);
select set_config('audit.weekly_other', gen_random_uuid()::text, true);
select set_config('audit.weekly_member', gen_random_uuid()::text, true);
select set_config('audit.weekly_guild', gen_random_uuid()::text, true);
select set_config('audit.weekly_other_guild', gen_random_uuid()::text, true);
select set_config('audit.weekly_character', gen_random_uuid()::text, true);
select set_config('audit.weekly_reset', private.raider_progress_reset('us')::text, true);
select set_config('audit.weekly_lodge', gen_random_uuid()::text, true);
select set_config('audit.weekly_event', gen_random_uuid()::text, true);
select set_config('audit.weekly_other_event', gen_random_uuid()::text, true);
select set_config('audit.weekly_operation', gen_random_uuid()::text, true);
select set_config('audit.weekly_other_operation', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'weekly-' || id || '@example.invalid', '', now(), now(), now(), jsonb_build_object('display_name', label)
from (values (current_setting('audit.weekly_leader')::uuid, 'Leader'),
  (current_setting('audit.weekly_other')::uuid, 'OtherLeader'),
  (current_setting('audit.weekly_member')::uuid, 'Raider')) people(id, label);
insert into public.guilds (id, name, slug, created_by) values
  (current_setting('audit.weekly_guild')::uuid, 'Weekly Audit', 'weekly-' || current_setting('audit.weekly_guild'), current_setting('audit.weekly_leader')::uuid),
  (current_setting('audit.weekly_other_guild')::uuid, 'Other Audit', 'weekly-' || current_setting('audit.weekly_other_guild'), current_setting('audit.weekly_other')::uuid);
insert into public.guild_members (guild_id, profile_id) values
  (current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_leader')::uuid),
  (current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_member')::uuid),
  (current_setting('audit.weekly_other_guild')::uuid, current_setting('audit.weekly_other')::uuid),
  (current_setting('audit.weekly_other_guild')::uuid, current_setting('audit.weekly_member')::uuid);
insert into public.guild_verified_claims (guild_id, profile_id, blizzard_character_id, region, realm_slug, guild_name, claimed_at, expires_at) values
  (current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_leader')::uuid, 98200001, 'us', 'realm', 'Weekly Audit', now() - interval '1 minute', now() + interval '1 day'),
  (current_setting('audit.weekly_other_guild')::uuid, current_setting('audit.weekly_other')::uuid, 98200002, 'us', 'realm', 'Other Audit', now() - interval '1 minute', now() + interval '1 day');
insert into public.guild_member_roles (guild_member_id, role, granted_by)
select id, 'guild_master', profile_id from public.guild_members where profile_id in
  (current_setting('audit.weekly_leader')::uuid, current_setting('audit.weekly_other')::uuid);
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_member')::uuid, id, 'us', 'realm', 'WeeklyRaider'
from public.games where slug = 'wow';
insert into public.character_guild_sharing (character_id, guild_id, visibility)
values (current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid, 'leadership');
insert into public.lodges (id, name, slug, created_by)
values (current_setting('audit.weekly_lodge')::uuid, 'Weekly audit Lodge', 'weekly-' || current_setting('audit.weekly_lodge'), current_setting('audit.weekly_leader')::uuid);
insert into public.events (id, lodge_id, created_by, title, event_date) values
  (current_setting('audit.weekly_event')::uuid, current_setting('audit.weekly_lodge')::uuid, current_setting('audit.weekly_leader')::uuid, 'Weekly audit raid', current_date + 1),
  (current_setting('audit.weekly_other_event')::uuid, current_setting('audit.weekly_lodge')::uuid, current_setting('audit.weekly_leader')::uuid, 'Other weekly audit raid', current_date + 2);
insert into public.guild_raid_operations (id, guild_id, event_id, authorized_by) values
  (current_setting('audit.weekly_operation')::uuid, current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_event')::uuid, current_setting('audit.weekly_leader')::uuid),
  (current_setting('audit.weekly_other_operation')::uuid, current_setting('audit.weekly_other_guild')::uuid, current_setting('audit.weekly_other_event')::uuid, current_setting('audit.weekly_other')::uuid);

do $$ begin
  if private.raider_progress_reset('us', '2026-11-03T15:59:59Z') is distinct from date '2026-11-03'
    or private.raider_progress_reset('us', '2026-11-03T16:00:00Z') is distinct from date '2026-11-10'
    or private.raider_progress_reset('eu', '2026-10-28T03:59:59Z') is distinct from date '2026-10-28'
    or private.raider_progress_reset('kr') is not null then raise exception 'Reset boundary failed'; end if;
  if has_function_privilege('anon', 'public.save_guild_weekly_requirement(uuid,uuid,text,date,integer,integer,integer)', 'execute')
    or has_column_privilege('authenticated', 'public.weekly_vault_progress', 'reported_at', 'insert')
    or has_column_privilege('authenticated', 'public.weekly_vault_progress', 'mythic_run_levels', 'update')
    or has_table_privilege('authenticated', 'public.guild_weekly_requirements', 'insert') then raise exception 'Direct-write grants failed'; end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
    raise exception 'Anonymous target call accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
      current_setting('audit.weekly_reset')::date, array[10], 0, 0, 0, 0, false);
    raise exception 'Anonymous report call accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_leader'), true);
select public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
select public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_operation')::uuid,
  'us', current_setting('audit.weekly_reset')::date, 4, 12, 6);
-- Updating one scope must not duplicate it or overwrite the other scope.
select public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
do $$ begin
  if (select count(*) from public.guild_weekly_requirements where guild_id = current_setting('audit.weekly_guild')::uuid) <> 2
    or (select mythic_runs_required from public.guild_weekly_requirements where operation_id = current_setting('audit.weekly_operation')::uuid) is distinct from 4
    then raise exception 'Guild and raid targets collided'; end if;
  begin
    perform public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_other_operation')::uuid,
      'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
    raise exception 'Foreign raid operation target accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_guild_weekly_requirement(current_setting('audit.weekly_other_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
    raise exception 'Cross-Guild target write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select set_config('audit.weekly_report', public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid,
  current_setting('audit.weekly_guild')::uuid, current_setting('audit.weekly_reset')::date,
  array[10,10,10,10,10,10], 6, 2, 2, null, false)::text, true);
do $$ begin
  if exists (select 1 from public.guild_weekly_requirements where operation_id is not null)
    then raise exception 'Private raid target leaked to member'; end if;
  if not exists (select 1 from public.guild_weekly_requirements where operation_id is null and guild_id = current_setting('audit.weekly_guild')::uuid)
    then raise exception 'Guild target unavailable to member'; end if;
  if (select mythic_run_levels from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid) is distinct from array[10,10,10,10,10,10]
    then raise exception 'Owner report save failed'; end if;
  begin
    perform public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
    raise exception 'Member target write accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
      current_setting('audit.weekly_reset')::date, array[1], 0, 0, 0, 0, false);
    raise exception 'Invalid run level accepted';
  exception when check_violation then null; end;
  begin
    perform public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
      current_setting('audit.weekly_reset')::date - 7, array[10], 0, 0, 0, 0, false);
    raise exception 'Old reset accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_leader'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Private progress leaked to leader'; end if;
  begin
    perform public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
      current_setting('audit.weekly_reset')::date, array[10], 0, 0, 0, 0, false);
    raise exception 'Leader edited another player report';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select public.set_guild_vault_sharing(current_setting('audit.weekly_report')::uuid, current_setting('audit.weekly_guild')::uuid, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_leader'), true);
do $$ begin
  if not exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Consented report unavailable'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_other'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Cross-Guild consent leaked'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select public.set_guild_vault_sharing(current_setting('audit.weekly_report')::uuid, current_setting('audit.weekly_guild')::uuid, false);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_leader'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Revoked report still visible'; end if;
end $$;
reset role;
-- Column constraints reject malformed reports without partially overwriting them.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
do $$ declare v_case integer; begin
  for v_case in 1..4 loop
    begin
      perform public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
        current_setting('audit.weekly_reset')::date,
        case when v_case = 1 then array[41] when v_case = 2 then array[null]::integer[] else array[10] end,
        case when v_case = 3 then -1 else 0 end,
        case when v_case = 4 then 4 else 0 end, 0, 0, false);
      raise exception 'Invalid report case % accepted', v_case;
    exception when check_violation then null; end;
  end loop;
  if (select mythic_run_levels from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid) is distinct from array[10,10,10,10,10,10]
    then raise exception 'Failed report partially overwrote saved counts'; end if;
  begin
    update public.weekly_vault_progress set reported_at = now() where id = current_setting('audit.weekly_report')::uuid;
    raise exception 'Direct recording-time write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- An explicit zero list and unknown list both save, with distinct meanings.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
  current_setting('audit.weekly_reset')::date, '{}'::integer[], 0, 0, 0, 0, false);
do $$ begin
  if (select mythic_run_levels from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid) is distinct from '{}'::integer[]
    then raise exception 'Explicit zero run list rejected or changed'; end if;
end $$;
select public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
  current_setting('audit.weekly_reset')::date, null, null, null, null, null, false);
do $$ begin
  if not exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid
    and mythic_run_levels is null and weekly_raid_bosses is null and dungeon_vault_slots is null)
    then raise exception 'Unknown values coerced to zero'; end if;
end $$;
reset role;
-- Expired leadership cannot write new targets even with a retained role row.
update public.guild_verified_claims set expires_at = now() - interval '1 second'
where guild_id = current_setting('audit.weekly_guild')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_leader'), true);
do $$ begin
  begin
    perform public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
    raise exception 'Expired leader saved target';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.guild_verified_claims set expires_at = now() + interval '1 day'
where guild_id = current_setting('audit.weekly_guild')::uuid;
-- Delegated raid leadership works only if granted after the current claim.
insert into public.guild_member_roles(guild_member_id, role, granted_by)
select id, 'raid_leader', current_setting('audit.weekly_leader')::uuid from public.guild_members
where guild_id = current_setting('audit.weekly_guild')::uuid and profile_id = current_setting('audit.weekly_member')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
reset role;
update public.guild_member_roles set granted_at = now() - interval '2 minutes'
where role = 'raid_leader' and guild_member_id in (select id from public.guild_members where profile_id = current_setting('audit.weekly_member')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
do $$ begin
  begin
    perform public.save_guild_weekly_requirement(current_setting('audit.weekly_guild')::uuid, null, 'us', current_setting('audit.weekly_reset')::date, 8, 10, null);
    raise exception 'Role predating current claim accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.guild_member_roles where role = 'raid_leader' and guild_member_id in
  (select id from public.guild_members where profile_id = current_setting('audit.weekly_member')::uuid);
-- Suspension is enforced inside the new definer RPC, independently of HTTP.
insert into public.app_account_access(profile_id, suspended)
values (current_setting('audit.weekly_member')::uuid, true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
do $$ begin
  begin
    perform public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
      current_setting('audit.weekly_reset')::date, array[10], 0, 0, 0, 0, false);
    raise exception 'Suspended account saved report';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.app_account_access where profile_id = current_setting('audit.weekly_member')::uuid;
-- The old notes-only insert/update path remains usable with column grants.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
insert into public.weekly_vault_progress(profile_id, character_id, reset_on, raid_progress)
values (current_setting('audit.weekly_member')::uuid, current_setting('audit.weekly_character')::uuid,
  current_setting('audit.weekly_reset')::date - 7, 'Legacy notes fixture');
update public.weekly_vault_progress set raid_progress = 'Legacy notes updated'
where character_id = current_setting('audit.weekly_character')::uuid and reset_on = current_setting('audit.weekly_reset')::date - 7;
do $$ begin
  if not exists (select 1 from public.weekly_vault_progress where raid_progress = 'Legacy notes updated'
    and character_id = current_setting('audit.weekly_character')::uuid)
    then raise exception 'Existing note workflow regressed'; end if;
end $$;
reset role;
-- One-Guild revocation must preserve a different, explicitly shared Guild.
insert into public.character_guild_sharing(character_id, guild_id, visibility)
values (current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_other_guild')::uuid, 'leadership');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select public.set_guild_vault_sharing(current_setting('audit.weekly_report')::uuid, current_setting('audit.weekly_other_guild')::uuid, true);
select public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
  current_setting('audit.weekly_reset')::date, array[10,10,10,10,10,10], 6, 2, 2, null, false);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_leader'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Unshared Guild regained access after save'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_other'), true);
do $$ begin
  if not exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Other explicit Guild choice lost on save'; end if;
end $$;
reset role;
-- A private save with nothing shared must not add Guild audit events.
select set_config('audit.weekly_audit_count', (select count(*) from public.guild_audit_events
  where guild_id = current_setting('audit.weekly_guild')::uuid)::text, true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_member'), true);
select public.save_weekly_raider_report(current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_guild')::uuid,
  current_setting('audit.weekly_reset')::date, array[10,10,10,10,10,10,10], 6, 2, 2, null, false);
reset role;
do $$ begin
  if (select count(*) from public.guild_audit_events where guild_id = current_setting('audit.weekly_guild')::uuid)
    <> current_setting('audit.weekly_audit_count')::bigint
    then raise exception 'Private save wrote a Guild audit event'; end if;
end $$;
-- Turning Traveler sharing off hides that Guild's weekly reports, even with week consent left in place.
delete from public.character_guild_sharing where character_id = current_setting('audit.weekly_character')::uuid
  and guild_id = current_setting('audit.weekly_other_guild')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_other'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Report visible after Traveler sharing was turned off'; end if;
end $$;
reset role;
insert into public.character_guild_sharing(character_id, guild_id, visibility)
values (current_setting('audit.weekly_character')::uuid, current_setting('audit.weekly_other_guild')::uuid, 'leadership');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_other'), true);
do $$ begin
  if not exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Re-sharing the Traveler did not restore the consented week'; end if;
end $$;
reset role;
delete from public.guild_members where guild_id = current_setting('audit.weekly_other_guild')::uuid
  and profile_id = current_setting('audit.weekly_member')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.weekly_other'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.weekly_report')::uuid)
    then raise exception 'Departed member report remains visible'; end if;
end $$;
reset role;
rollback;
select 'WEEKLY PROGRESS SYNTHETIC REHEARSAL PASSED AND ROLLED BACK' as result;
