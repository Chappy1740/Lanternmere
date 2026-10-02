-- Current-schema fixture body. Run only inside an explicit transaction after
-- the Milestone 7 audit migration, then ROLLBACK. Creates synthetic users only.
do $$
declare
  v_master uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_guild uuid := gen_random_uuid();
  v_master_row uuid := gen_random_uuid();
  v_member_row uuid := gen_random_uuid();
  v_character uuid := gen_random_uuid();
  v_vault uuid := gen_random_uuid();
  v_transfer uuid := gen_random_uuid();
  v_game uuid;
begin
  if has_table_privilege('authenticated', 'public.guild_members', 'delete')
    or has_table_privilege('authenticated', 'public.guild_member_roles', 'insert')
    or has_table_privilege('authenticated', 'public.guild_member_roles', 'delete')
    or has_function_privilege('authenticated',
      'public.replace_guild_official_roster(uuid,text,text,text,text,timestamp with time zone,jsonb)', 'execute')
  then raise exception 'Ordinary role retained a direct Guild write'; end if;

  select id into v_game from public.games where slug = 'wow';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  values
    (v_master, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'm7-master-' || v_master || '@example.invalid', '', now(), now(), now(),
      '{"display_name":"AuditMaster"}'::jsonb),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'm7-member-' || v_member || '@example.invalid', '', now(), now(), now(),
      '{"display_name":"AuditMember"}'::jsonb);
  insert into public.guilds (id, name, slug, created_by)
  values (v_guild, 'M7 Audit Guild', 'm7-audit-' || v_guild, v_master);
  insert into public.guild_members (id, guild_id, profile_id)
  values (v_master_row, v_guild, v_master), (v_member_row, v_guild, v_member);
  insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
  values (v_character, v_member, v_game, 'us', 'stormrage', 'Auditmember');
  insert into public.weekly_vault_progress (id, profile_id, character_id, reset_on)
  values (v_vault, v_member, v_character, current_date);
  insert into public.character_guild_sharing (character_id, guild_id, visibility)
  values (v_character, v_guild, 'leadership');
  insert into public.guild_vault_sharing (vault_progress_id, guild_id, profile_id)
  values (v_vault, v_guild, v_member);
  insert into public.guild_member_availability
    (guild_id, profile_id, starts_on, ends_on, availability_status)
  values (v_guild, v_member, current_date, current_date, 'available');
  insert into public.guild_ownership_transfers
    (id, guild_id, from_member_id, to_member_id, initiated_by, expires_at)
  values (v_transfer, v_guild, v_master_row, v_member_row, v_master, now() + interval '1 day');

  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  perform public.set_guild_character_sharing(v_guild, v_character, 'members');
  if (select visibility from public.character_guild_sharing
      where character_id = v_character and guild_id = v_guild) <> 'members'
  then raise exception 'Existing sharing level did not change'; end if;

  -- A duplicate replacement fails after DELETE and INSERT have begun, but the
  -- entire function call rolls back to its previous successful snapshot.
  perform public.replace_guild_official_roster(v_guild, 'us', 'stormrage',
    'M7 Audit Guild', 'https://worldofwarcraft.blizzard.com/audit', now(),
    '[{"blizzard_character_id":1,"character_name":"First","realm_slug":"stormrage","rank_index":0}]'::jsonb);
  begin
    perform public.replace_guild_official_roster(v_guild, 'us', 'stormrage',
      'M7 Audit Guild', 'https://worldofwarcraft.blizzard.com/audit', now(),
      '[{"blizzard_character_id":2,"character_name":"Second","realm_slug":"stormrage","rank_index":1},{"blizzard_character_id":2,"character_name":"Duplicate","realm_slug":"stormrage","rank_index":1}]'::jsonb);
    raise exception 'Duplicate roster replacement was accepted';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.guild_roster_entries where guild_id = v_guild) <> 1
    or not exists (select 1 from public.guild_roster_entries
      where guild_id = v_guild and blizzard_character_id = 1)
    or (select count(*) from public.guild_blizzard_roster_snapshots
      where guild_id = v_guild) <> 1
  then raise exception 'Failed roster replacement changed the last good data'; end if;

  delete from public.guild_members where id = v_member_row;
  if exists (select 1 from public.character_guild_sharing
      where character_id = v_character and guild_id = v_guild)
    or exists (select 1 from public.guild_vault_sharing
      where vault_progress_id = v_vault and guild_id = v_guild)
    or exists (select 1 from public.guild_member_availability
      where guild_id = v_guild and profile_id = v_member)
  then raise exception 'Guild departure retained private consent or availability'; end if;
  if not exists (select 1 from public.guild_ownership_transfers
      where id = v_transfer and to_member_id is null and canceled_at is not null)
  then raise exception 'Departure blocked or did not preserve transfer history'; end if;
end;
$$;
select 'M7 GUILD OPERATIONS REHEARSAL PASSED; outer transaction must roll back' as result;
