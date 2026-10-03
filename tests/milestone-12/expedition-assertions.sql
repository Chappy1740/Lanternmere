-- Synthetic fixture body. The caller must wrap this in BEGIN ... ROLLBACK.
select set_config('audit.m12_master', gen_random_uuid()::text, true);
select set_config('audit.m12_member', gen_random_uuid()::text, true);
select set_config('audit.m12_other', gen_random_uuid()::text, true);
select set_config('audit.m12_guild', gen_random_uuid()::text, true);
select set_config('audit.m12_other_guild', gen_random_uuid()::text, true);
select set_config('audit.m12_character', gen_random_uuid()::text, true);
select set_config('audit.m12_other_character', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm12-' || id || '@example.invalid', '', now(), now(), now(),
  jsonb_build_object('display_name', label)
from (values
  (current_setting('audit.m12_master')::uuid, 'AuditLeader'),
  (current_setting('audit.m12_member')::uuid, 'AuditRunner'),
  (current_setting('audit.m12_other')::uuid, 'AuditOther')
) as people(id, label);
insert into public.guilds (id, name, slug, created_by)
values (current_setting('audit.m12_guild')::uuid, 'M12 Audit Guild',
    'm12-a-' || current_setting('audit.m12_guild'), current_setting('audit.m12_master')::uuid),
  (current_setting('audit.m12_other_guild')::uuid, 'M12 Other Guild',
    'm12-b-' || current_setting('audit.m12_other_guild'), current_setting('audit.m12_other')::uuid);
insert into public.guild_members (guild_id, profile_id)
values (current_setting('audit.m12_guild')::uuid, current_setting('audit.m12_master')::uuid),
  (current_setting('audit.m12_guild')::uuid, current_setting('audit.m12_member')::uuid),
  (current_setting('audit.m12_other_guild')::uuid, current_setting('audit.m12_other')::uuid);
insert into public.guild_verified_claims
  (guild_id, profile_id, blizzard_character_id, region, realm_slug, guild_name, claimed_at, expires_at)
values (current_setting('audit.m12_guild')::uuid, current_setting('audit.m12_master')::uuid,
    12000001, 'us', 'stormrage', 'M12 Audit Guild', now() - interval '1 minute', now() + interval '1 day'),
  (current_setting('audit.m12_other_guild')::uuid, current_setting('audit.m12_other')::uuid,
    12000002, 'us', 'stormrage', 'M12 Other Guild', now() - interval '1 minute', now() + interval '1 day');
insert into public.guild_member_roles (guild_member_id, role, granted_by)
select id, 'guild_master', profile_id from public.guild_members
where (guild_id = current_setting('audit.m12_guild')::uuid
    and profile_id = current_setting('audit.m12_master')::uuid)
  or (guild_id = current_setting('audit.m12_other_guild')::uuid
    and profile_id = current_setting('audit.m12_other')::uuid);
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select character_id, owner_id, game.id, 'us', 'stormrage', character_name
from public.games game cross join (values
  (current_setting('audit.m12_character')::uuid,
    current_setting('audit.m12_member')::uuid, 'AuditRunner'),
  (current_setting('audit.m12_other_character')::uuid,
    current_setting('audit.m12_other')::uuid, 'AuditOutsider')
) as owned(character_id, owner_id, character_name)
where game.slug = 'wow';
insert into public.character_raiderio_snapshots
  (character_id, character_name, realm_slug, region, mythic_plus_score, source_url, refreshed_at)
values (current_setting('audit.m12_character')::uuid, 'AuditRunner', 'stormrage', 'us', 2026,
  'https://raider.io/characters/us/stormrage/AuditRunner', now() - interval '2 hours');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m12_master'), true);
select set_config('audit.m12_post', public.create_guild_mythic_post(
  current_setting('audit.m12_guild')::uuid, 'Audit Dungeon', 2, 12,
  now() + interval '2 days', 1, 1, 3, 'Synthetic key night')::text, true);
do $$ begin
  if has_table_privilege('authenticated', 'public.guild_mythic_posts', 'insert')
    or has_table_privilege('authenticated', 'public.guild_mythic_interests', 'update')
    or has_table_privilege('authenticated', 'public.guild_mythic_goals', 'insert')
  then raise exception 'Direct-write boundary failed'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m12_member'), true);
select public.set_guild_mythic_interest(current_setting('audit.m12_post')::uuid,
  current_setting('audit.m12_character')::uuid, 'damage', false);
do $$ begin
  if (select score_source_url from public.guild_mythic_interests
      where post_id = current_setting('audit.m12_post')::uuid) is not null
  then raise exception 'Raider.IO score leaked without consent'; end if;
  begin
    perform public.set_guild_mythic_interest(current_setting('audit.m12_post')::uuid,
      current_setting('audit.m12_other_character')::uuid, 'damage', true);
    raise exception 'Unowned Traveler accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_guild_mythic_interest(current_setting('audit.m12_post')::uuid,
      current_setting('audit.m12_character')::uuid, 'support', false);
    raise exception 'Unrequested role accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
select public.set_guild_mythic_interest(current_setting('audit.m12_post')::uuid,
  current_setting('audit.m12_character')::uuid, 'damage', true);
do $$ begin
  if (select score from public.guild_mythic_interests
      where post_id = current_setting('audit.m12_post')::uuid) <> 2026
  then raise exception 'Explicit score share failed'; end if;
end $$;
select public.set_guild_mythic_interest(current_setting('audit.m12_post')::uuid,
  current_setting('audit.m12_character')::uuid, 'damage', false);
do $$ begin
  if (select score_source_url from public.guild_mythic_interests
      where post_id = current_setting('audit.m12_post')::uuid) is not null
  then raise exception 'Score revocation failed'; end if;
end $$;
select set_config('audit.m12_goal', public.save_guild_mythic_goal(
  current_setting('audit.m12_guild')::uuid, current_date + 7, 4, 10, 1,
  'Private synthetic plan', false)::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m12_other'), true);
do $$ begin
  if exists (select 1 from public.guild_mythic_posts
      where id = current_setting('audit.m12_post')::uuid)
    or exists (select 1 from public.guild_mythic_goals
      where id = current_setting('audit.m12_goal')::uuid)
  then raise exception 'Cross-Guild post or private goal leaked'; end if;
  begin
    perform public.set_guild_mythic_post_status(current_setting('audit.m12_post')::uuid, 'closed');
    raise exception 'Other Guild closed a post';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_guild_mythic_post(current_setting('audit.m12_post')::uuid);
    raise exception 'Other Guild removed a post';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m12_member'), true);
select public.save_guild_mythic_goal(current_setting('audit.m12_guild')::uuid,
  current_date + 7, 4, 10, 2, 'Shared synthetic plan', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m12_master'), true);
do $$ begin
  if not exists (select 1 from public.guild_mythic_goals
      where id = current_setting('audit.m12_goal')::uuid and completed_runs = 2 and shared)
  then raise exception 'Guild goal sharing failed'; end if;
end $$;
select public.set_guild_mythic_post_status(current_setting('audit.m12_post')::uuid, 'closed');
reset role;

delete from public.guild_members where guild_id = current_setting('audit.m12_guild')::uuid
  and profile_id = current_setting('audit.m12_member')::uuid;
do $$ begin
  if exists (select 1 from public.guild_mythic_interests
      where guild_id = current_setting('audit.m12_guild')::uuid)
    or exists (select 1 from public.guild_mythic_goals
      where guild_id = current_setting('audit.m12_guild')::uuid)
  then raise exception 'Guild departure did not clear Mythic+ data'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m12_master'), true);
select public.delete_guild_mythic_post(current_setting('audit.m12_post')::uuid);
reset role;
do $$ begin
  if exists (select 1 from public.guild_mythic_posts
      where id = current_setting('audit.m12_post')::uuid)
  then raise exception 'Organizer could not delete group post'; end if;
end $$;
select 'Milestone 12 synthetic Expedition Board checks passed; caller must roll back' as result;
