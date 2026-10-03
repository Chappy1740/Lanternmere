-- Current-schema fixture body. Run only inside an explicit transaction after
-- the Milestone 8 audit migration, then ROLLBACK. All accounts are synthetic.
do $$
declare
  v_master uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_guild uuid := gen_random_uuid();
  v_other_guild uuid := gen_random_uuid();
  v_master_row uuid := gen_random_uuid();
  v_member_row uuid := gen_random_uuid();
  v_other_row uuid := gen_random_uuid();
  v_lodge uuid := gen_random_uuid();
  v_event uuid := gen_random_uuid();
  v_operation uuid := gen_random_uuid();
  v_drop uuid;
  v_candidate uuid;
  v_character uuid := gen_random_uuid();
  v_game uuid;
begin
  if has_table_privilege('authenticated', 'public.guild_raid_loot_candidates', 'update')
    or has_table_privilege('authenticated', 'public.guild_raid_loot_awards', 'delete')
  then raise exception 'Direct loot writes remain available'; end if;

  select id into v_game from public.games where slug = 'wow';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  values
    (v_master, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'm8-master-' || v_master || '@example.invalid', '', now(), now(), now(),
      '{"display_name":"AuditMaster"}'::jsonb),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'm8-member-' || v_member || '@example.invalid', '', now(), now(), now(),
      '{"display_name":"AuditMember"}'::jsonb),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'm8-other-' || v_other || '@example.invalid', '', now(), now(), now(),
      '{"display_name":"AuditOther"}'::jsonb);
  insert into public.guilds (id, name, slug, created_by)
  values (v_guild, 'M8 Audit Guild', 'm8-audit-' || v_guild, v_master),
    (v_other_guild, 'M8 Other Guild', 'm8-other-' || v_other_guild, v_other);
  insert into public.guild_members (id, guild_id, profile_id)
  values (v_master_row, v_guild, v_master),
    (v_member_row, v_guild, v_member),
    (v_other_row, v_other_guild, v_other);
  insert into public.guild_verified_claims
    (guild_id, profile_id, blizzard_character_id, region, realm_slug,
      guild_name, claimed_at, expires_at)
  values (v_guild, v_master, 80000001, 'us', 'stormrage', 'M8 Audit Guild',
    now() - interval '1 minute', now() + interval '7 days');
  insert into public.guild_member_roles (guild_member_id, role, granted_by)
  values (v_master_row, 'guild_master', v_master);
  insert into public.lodges (id, name, slug, created_by)
  values (v_lodge, 'M8 Audit Lodge', 'm8-lodge-' || v_lodge, v_master);
  insert into public.lodge_members (lodge_id, profile_id, role)
  values (v_lodge, v_master, 'owner');
  insert into public.events (id, lodge_id, created_by, title, event_date)
  values (v_event, v_lodge, v_master, 'M8 Audit Raid', current_date);
  insert into public.guild_raid_operations (id, guild_id, event_id, authorized_by)
  values (v_operation, v_guild, v_event, v_master);
  insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
  values (v_character, v_member, v_game, 'us', 'stormrage', 'Auditmember');
  insert into public.character_guild_sharing (character_id, guild_id, visibility)
  values (v_character, v_guild, 'leadership');
  insert into public.guild_raid_operation_members
    (operation_id, guild_member_id, planning_status, raid_role, planned_by)
  values (v_operation, v_member_row, 'selected', 'dps', v_master);

  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_master, 'role', 'authenticated')::text, true);
  if not private.can_lead_guild(v_guild) then
    raise exception 'Synthetic Guild Master claim failed'; end if;
  perform public.set_guild_raid_operation_member_character(v_operation, v_member_row, v_character);
  perform public.set_guild_raid_operation_member_character(v_operation, v_member_row, null);
  if exists (select 1 from public.guild_raid_operation_members
    where operation_id = v_operation and guild_member_id = v_member_row
      and character_id is not null) then
    raise exception 'Character context was not cleared'; end if;

  v_drop := public.create_guild_raid_loot_drop(v_operation, 'Audit Helm', 600, 'Head', 'Fixture');
  begin
    perform public.set_guild_raid_loot_candidate(v_drop, v_other_row, 'need', 'Wrong Guild');
    raise exception 'Cross-Guild candidate was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.set_guild_raid_loot_candidate(v_drop, v_member_row, 'need', 'Priority upgrade');
  select id into v_candidate from public.guild_raid_loot_candidates
  where loot_drop_id = v_drop and guild_member_id = v_member_row;
  if v_candidate is null then raise exception 'Candidate missing'; end if;
  perform public.cast_guild_raid_loot_vote(v_drop, v_candidate, 'Best fit');
  perform public.award_guild_raid_loot(v_drop, v_candidate, 'Council decision');
  begin
    perform public.set_guild_raid_loot_candidate(v_drop, v_member_row, 'pass', 'Changed');
    raise exception 'Candidate changed after award';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cast_guild_raid_loot_vote(v_drop, v_candidate, 'Changed');
    raise exception 'Vote changed after award';
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from public.guild_audit_events
    where guild_id = v_guild and action = 'guild.loot_vote_cast'
      and metadata ? 'rationale_sha256')
    or not exists (select 1 from public.guild_audit_events
      where guild_id = v_guild and action = 'guild.loot_candidate_recorded'
        and metadata ? 'factual_context_sha256') then
    raise exception 'Loot decision audit hashes missing'; end if;

  delete from public.guild_members where id = v_member_row;
  if not exists (select 1 from public.guild_raid_loot_candidates
    where id = v_candidate and guild_member_id is null and member_label = 'AuditMember')
    or not exists (select 1 from public.guild_raid_loot_votes
      where candidate_id = v_candidate and rationale = 'Best fit')
    or not exists (select 1 from public.guild_raid_loot_awards
      where loot_drop_id = v_drop and candidate_id = v_candidate)
  then raise exception 'Awarded member departure lost loot history'; end if;
  perform set_config('m8.synthetic_guild', v_guild::text, true);
  perform set_config('m8.synthetic_member', v_member::text, true);
  perform set_config('m8.synthetic_drop', v_drop::text, true);
end;
$$;

-- Ordinary former members cannot read Raid Room or Loot Council records.
select set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('m8.synthetic_member'),
    'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.guild_raid_loot_drops
      where id = current_setting('m8.synthetic_drop')::uuid)
    or exists (select 1 from public.guild_raid_loot_candidates
      where loot_drop_id = current_setting('m8.synthetic_drop')::uuid)
    or exists (select 1 from public.guild_raid_loot_awards
      where loot_drop_id = current_setting('m8.synthetic_drop')::uuid)
  then raise exception 'Former member can read private loot'; end if;
end;
$$;
set local role postgres;
delete from public.guilds where id = current_setting('m8.synthetic_guild')::uuid;
do $$ begin
  if exists (select 1 from public.guild_raid_loot_awards
      where loot_drop_id = current_setting('m8.synthetic_drop')::uuid)
  then raise exception 'Guild deletion retained an orphaned award'; end if;
end;
$$;
select 'M8 RAID ROOM REHEARSAL PASSED; outer transaction must roll back' as result;
