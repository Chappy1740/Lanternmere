-- Synthetic fixture body. Run only inside one transaction ending in ROLLBACK.
select set_config('audit.m14_leader', gen_random_uuid()::text, true);
select set_config('audit.m14_other', gen_random_uuid()::text, true);
select set_config('audit.m14_guild', gen_random_uuid()::text, true);
select set_config('audit.m14_claim', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm14-' || id || '@example.invalid', '', now(), now(), now(),
  jsonb_build_object('display_name', label)
from (values
  (current_setting('audit.m14_leader')::uuid, 'AuditLeader'),
  (current_setting('audit.m14_other')::uuid, 'AuditOther')
) as people(id, label);
insert into public.guilds(id, name, slug, created_by)
values (current_setting('audit.m14_guild')::uuid, 'M14 Audit Guild',
  'm14-' || current_setting('audit.m14_guild'), current_setting('audit.m14_leader')::uuid);
insert into public.guild_members(guild_id, profile_id)
values (current_setting('audit.m14_guild')::uuid, current_setting('audit.m14_leader')::uuid),
  (current_setting('audit.m14_guild')::uuid, current_setting('audit.m14_other')::uuid);
insert into public.guild_verified_claims
  (guild_id, profile_id, blizzard_character_id, region, realm_slug, guild_name, claimed_at, expires_at)
values (current_setting('audit.m14_guild')::uuid, current_setting('audit.m14_leader')::uuid,
  14000001, 'us', 'stormrage', 'M14 Audit Guild', now() - interval '1 minute', now() + interval '1 day');
insert into public.guild_member_roles(guild_member_id, role, granted_by)
select id, 'guild_master', profile_id from public.guild_members
where profile_id = current_setting('audit.m14_leader')::uuid;

do $$ begin
  if has_table_privilege('authenticated', 'public.lanternkeeper_requests', 'select')
    or has_table_privilege('authenticated', 'public.lanternkeeper_requests', 'insert')
    or has_function_privilege('authenticated',
      'public.finish_lanternkeeper_request(uuid,text,text,text,integer,integer,integer)', 'execute')
  then raise exception 'Lanternkeeper audit metadata is exposed'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m14_other'), true);
do $$ begin
  begin
    perform public.claim_lanternkeeper_request(current_setting('audit.m14_guild')::uuid, 'weekly');
    raise exception 'Unverified member claimed AI budget';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('audit.m14_leader'), true);
select set_config('audit.m14_request', public.claim_lanternkeeper_request(
  current_setting('audit.m14_guild')::uuid, 'weekly')::text, true);
do $$ begin
  if current_setting('audit.m14_request', true) is null then
    raise exception 'Verified leader could not claim request';
  end if;
  begin
    perform public.claim_lanternkeeper_request(gen_random_uuid(), 'weekly');
    raise exception 'Cross-Guild request accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_lanternkeeper_request(current_setting('audit.m14_guild')::uuid, 'invalid');
    raise exception 'Invalid view accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.claim_lanternkeeper_request(current_setting('audit.m14_guild')::uuid, 'raid')
from generate_series(1, 5);
do $$ begin
  if public.claim_lanternkeeper_request(current_setting('audit.m14_guild')::uuid, 'changes') is not null
  then raise exception 'Per-user hourly limit failed'; end if;
end $$;
reset role;

-- Fill the Guild-wide window with synthetic metadata, then verify another leader is blocked.
insert into public.lanternkeeper_requests(user_id, guild_id, view)
select current_setting('audit.m14_other')::uuid, current_setting('audit.m14_guild')::uuid,
  'weekly' from generate_series(1, 34);
insert into public.guild_member_roles(guild_member_id, role, granted_by)
select id, 'officer', current_setting('audit.m14_leader')::uuid
from public.guild_members where profile_id = current_setting('audit.m14_other')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m14_other'), true);
do $$ begin
  if public.claim_lanternkeeper_request(current_setting('audit.m14_guild')::uuid, 'weekly') is not null
  then raise exception 'Guild daily limit failed'; end if;
end $$;
reset role;

set local role service_role;
select public.finish_lanternkeeper_request(current_setting('audit.m14_request')::uuid,
  'success', 'openai', 'audit-model', 100, 25, 30);
reset role;
do $$ begin
  if (select status from public.lanternkeeper_requests
      where id = current_setting('audit.m14_request')::uuid) <> 'success'
  then raise exception 'Audit completion failed'; end if;
  if (select count(*) from public.lanternkeeper_requests
      where guild_id = current_setting('audit.m14_guild')::uuid) <> 40
  then raise exception 'Budget attempts were not retained'; end if;
end $$;
select 'Milestone 14 synthetic budget checks passed (transaction must roll back)' as result;
