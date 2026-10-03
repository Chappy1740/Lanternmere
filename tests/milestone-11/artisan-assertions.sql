-- Current-schema fixture body. Run only inside BEGIN ... ROLLBACK.
-- All accounts, Guilds, Travelers, capabilities, requests, and goals are synthetic.
select set_config('audit.m11_master', gen_random_uuid()::text, true);
select set_config('audit.m11_member', gen_random_uuid()::text, true);
select set_config('audit.m11_other', gen_random_uuid()::text, true);
select set_config('audit.m11_guild', gen_random_uuid()::text, true);
select set_config('audit.m11_other_guild', gen_random_uuid()::text, true);
select set_config('audit.m11_character', gen_random_uuid()::text, true);
select set_config('audit.m11_master_character', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm11-' || id || '@example.invalid', '', now(), now(), now(),
  jsonb_build_object('display_name', label)
from (values
  (current_setting('audit.m11_master')::uuid, 'AuditMaster'),
  (current_setting('audit.m11_member')::uuid, 'AuditCrafter'),
  (current_setting('audit.m11_other')::uuid, 'AuditOther')
) as people(id, label);
insert into public.guilds (id, name, slug, created_by)
values (current_setting('audit.m11_guild')::uuid, 'M11 Audit Guild',
    'm11-a-' || current_setting('audit.m11_guild'), current_setting('audit.m11_master')::uuid),
  (current_setting('audit.m11_other_guild')::uuid, 'M11 Other Guild',
    'm11-b-' || current_setting('audit.m11_other_guild'), current_setting('audit.m11_other')::uuid);
insert into public.guild_members (guild_id, profile_id)
values (current_setting('audit.m11_guild')::uuid, current_setting('audit.m11_master')::uuid),
  (current_setting('audit.m11_guild')::uuid, current_setting('audit.m11_member')::uuid),
  (current_setting('audit.m11_other_guild')::uuid, current_setting('audit.m11_other')::uuid);
insert into public.guild_verified_claims
  (guild_id, profile_id, blizzard_character_id, region, realm_slug, guild_name, claimed_at, expires_at)
values (current_setting('audit.m11_guild')::uuid, current_setting('audit.m11_master')::uuid,
    11000001, 'us', 'stormrage', 'M11 Audit Guild', now() - interval '1 minute', now() + interval '1 day'),
  (current_setting('audit.m11_other_guild')::uuid, current_setting('audit.m11_other')::uuid,
    11000002, 'us', 'stormrage', 'M11 Other Guild', now() - interval '1 minute', now() + interval '1 day');
insert into public.guild_member_roles (guild_member_id, role, granted_by)
select id, 'guild_master', profile_id from public.guild_members
where (guild_id = current_setting('audit.m11_guild')::uuid
    and profile_id = current_setting('audit.m11_master')::uuid)
  or (guild_id = current_setting('audit.m11_other_guild')::uuid
    and profile_id = current_setting('audit.m11_other')::uuid);
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select character_id, owner_id, game.id, 'us', 'stormrage', character_name
from public.games game cross join (values
  (current_setting('audit.m11_character')::uuid,
    current_setting('audit.m11_member')::uuid, 'AuditCrafter'),
  (current_setting('audit.m11_master_character')::uuid,
    current_setting('audit.m11_master')::uuid, 'AuditLeader')
) as owned(character_id, owner_id, character_name)
where game.slug = 'wow';

-- Member explicitly publishes their owned Traveler and creates a Guild request.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m11_member'), true);
select set_config('audit.m11_offering', public.add_guild_artisan_offering(
  current_setting('audit.m11_guild')::uuid, current_setting('audit.m11_character')::uuid,
  'Alchemy', 'Potion Mastery', 'Audit Flask', 'Synthetic crafting note')::text, true);
select set_config('audit.m11_member_request', public.create_guild_crafting_request(
  current_setting('audit.m11_guild')::uuid, 'consumable', 'Audit Flask', 5,
  'Synthetic request')::text, true);
do $$ begin
  if (select count(*) from public.guild_artisan_offerings
      where guild_id = current_setting('audit.m11_guild')::uuid) <> 1
    or has_table_privilege('authenticated', 'public.guild_artisan_offerings', 'insert')
    or has_table_privilege('authenticated', 'public.guild_crafting_requests', 'update')
  then raise exception 'Member capability or direct-write boundary failed'; end if;
  begin
    perform public.save_guild_supply_goal(current_setting('audit.m11_guild')::uuid,
      null, 'Audit Material', 100, 0, '', true);
    raise exception 'Member changed a leadership supply goal';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.add_guild_artisan_offering(current_setting('audit.m11_guild')::uuid,
      current_setting('audit.m11_master_character')::uuid,
      'Blacksmithing', '', '', 'Not my Traveler');
    raise exception 'Member published an unowned Traveler';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- Other Guild leadership cannot see or change Guild A records.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m11_other'), true);
do $$ begin
  if exists (select 1 from public.guild_artisan_offerings
      where id = current_setting('audit.m11_offering')::uuid)
    or exists (select 1 from public.guild_crafting_requests
      where id = current_setting('audit.m11_member_request')::uuid)
  then raise exception 'Cross-Guild artisan data leaked'; end if;
  begin
    perform public.delete_guild_artisan_offering(current_setting('audit.m11_offering')::uuid);
    raise exception 'Other Guild removed capability';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_guild_crafting_request(current_setting('audit.m11_guild')::uuid,
      'craft', 'Cross-Guild request', 1, 'Denied');
    raise exception 'Other Guild posted a request';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Verified Guild Master can maintain manual goals and open a request.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m11_master'), true);
select set_config('audit.m11_goal', public.save_guild_supply_goal(
  current_setting('audit.m11_guild')::uuid, null, 'Audit Material', 100, 12,
  'Manual synthetic progress, not inventory', true)::text, true);
select set_config('audit.m11_master_request', public.create_guild_crafting_request(
  current_setting('audit.m11_guild')::uuid, 'material', 'Audit Ore', 2,
  'Synthetic member-exit rehearsal')::text, true);
reset role;

-- Member volunteers for the Master's request and the Master can mark the member's request complete.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m11_member'), true);
select public.set_guild_crafting_request_status(
  current_setting('audit.m11_master_request')::uuid, 'in_progress');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m11_master'), true);
select public.set_guild_crafting_request_status(
  current_setting('audit.m11_member_request')::uuid, 'in_progress');
select public.set_guild_crafting_request_status(
  current_setting('audit.m11_member_request')::uuid, 'completed');
do $$ begin
  if (select status from public.guild_crafting_requests
      where id = current_setting('audit.m11_member_request')::uuid) <> 'completed'
    or (select current_quantity from public.guild_supply_goals
      where id = current_setting('audit.m11_goal')::uuid) <> 12
  then raise exception 'Crafting workflow or manual goal failed'; end if;
end $$;
reset role;

-- Departure removes consented offerings and their own requests; it reopens unfulfilled volunteer work.
delete from public.guild_members
where guild_id = current_setting('audit.m11_guild')::uuid
  and profile_id = current_setting('audit.m11_member')::uuid;
do $$ begin
  if exists (select 1 from public.guild_artisan_offerings
      where id = current_setting('audit.m11_offering')::uuid)
    or exists (select 1 from public.guild_crafting_requests
      where id = current_setting('audit.m11_member_request')::uuid)
    or (select status from public.guild_crafting_requests
      where id = current_setting('audit.m11_master_request')::uuid) <> 'open'
    or (select volunteered_by from public.guild_crafting_requests
      where id = current_setting('audit.m11_master_request')::uuid) is not null
  then raise exception 'Guild departure did not clear artisan sharing'; end if;
end $$;
select 'Milestone 11 synthetic artisan checks passed; caller must roll back' as result;
