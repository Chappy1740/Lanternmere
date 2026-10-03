-- Current-schema synthetic fixture. The entire transaction MUST roll back.
begin;

select set_config('audit.m9_leader_a', gen_random_uuid()::text, true);
select set_config('audit.m9_leader_b', gen_random_uuid()::text, true);
select set_config('audit.m9_member', gen_random_uuid()::text, true);
select set_config('audit.m9_guild_a', gen_random_uuid()::text, true);
select set_config('audit.m9_guild_b', gen_random_uuid()::text, true);
select set_config('audit.m9_vault', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  (current_setting('audit.m9_leader_a')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm9-leader-a-' || current_setting('audit.m9_leader_a') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditLeaderA"}'::jsonb),
  (current_setting('audit.m9_leader_b')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm9-leader-b-' || current_setting('audit.m9_leader_b') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditLeaderB"}'::jsonb),
  (current_setting('audit.m9_member')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm9-member-' || current_setting('audit.m9_member') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditMember"}'::jsonb);

insert into public.guilds (id, name, slug, created_by)
values
  (current_setting('audit.m9_guild_a')::uuid, 'M9 Audit Guild A', 'm9-a-' || current_setting('audit.m9_guild_a'), current_setting('audit.m9_leader_a')::uuid),
  (current_setting('audit.m9_guild_b')::uuid, 'M9 Audit Guild B', 'm9-b-' || current_setting('audit.m9_guild_b'), current_setting('audit.m9_leader_b')::uuid);
insert into public.guild_members (guild_id, profile_id)
values
  (current_setting('audit.m9_guild_a')::uuid, current_setting('audit.m9_leader_a')::uuid),
  (current_setting('audit.m9_guild_a')::uuid, current_setting('audit.m9_member')::uuid),
  (current_setting('audit.m9_guild_b')::uuid, current_setting('audit.m9_leader_b')::uuid);
insert into public.guild_verified_claims
  (guild_id, profile_id, blizzard_character_id, region, realm_slug, guild_name, claimed_at, expires_at)
values
  (current_setting('audit.m9_guild_a')::uuid, current_setting('audit.m9_leader_a')::uuid, 90000001, 'us', 'stormrage', 'M9 Audit Guild A', now() - interval '1 minute', now() + interval '1 day'),
  (current_setting('audit.m9_guild_b')::uuid, current_setting('audit.m9_leader_b')::uuid, 90000002, 'us', 'stormrage', 'M9 Audit Guild B', now() - interval '1 minute', now() + interval '1 day');
insert into public.guild_member_roles (guild_member_id, role, granted_by)
select id, 'guild_master', profile_id from public.guild_members
where profile_id in (current_setting('audit.m9_leader_a')::uuid, current_setting('audit.m9_leader_b')::uuid);

insert into public.characters (profile_id, game_id, region, realm_slug, character_name)
select current_setting('audit.m9_member')::uuid, id, 'us', 'stormrage', 'Auditmember'
from public.games where slug = 'wow';
insert into public.weekly_vault_progress (id, profile_id, character_id, reset_on, notes)
select current_setting('audit.m9_vault')::uuid, current_setting('audit.m9_member')::uuid,
  id, current_date, 'Synthetic note'
from public.characters where profile_id = current_setting('audit.m9_member')::uuid;
insert into public.guild_vault_sharing (vault_progress_id, guild_id, profile_id)
values (current_setting('audit.m9_vault')::uuid, current_setting('audit.m9_guild_a')::uuid, current_setting('audit.m9_member')::uuid);
insert into public.guild_member_availability
  (guild_id, profile_id, starts_on, ends_on, availability_status)
values (current_setting('audit.m9_guild_a')::uuid, current_setting('audit.m9_member')::uuid,
  current_date, current_date + 1, 'tentative');
insert into public.guild_calendar_entries
  (guild_id, title, category, event_date, created_by)
values (current_setting('audit.m9_guild_a')::uuid, 'Synthetic plan', 'meeting',
  current_date + 1, current_setting('audit.m9_leader_a')::uuid);

-- Guild A's verified leader can see the explicitly shared row and operational context.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m9_leader_a'), true);
do $$ begin
  if (select count(*) from public.weekly_vault_progress where id = current_setting('audit.m9_vault')::uuid) <> 1
    or (select count(*) from public.guild_vault_sharing where vault_progress_id = current_setting('audit.m9_vault')::uuid) <> 1
    or (select count(*) from public.profiles where id = current_setting('audit.m9_member')::uuid) <> 1
    or (select count(*) from public.guild_member_availability where guild_id = current_setting('audit.m9_guild_a')::uuid) <> 1
    or (select count(*) from public.guild_calendar_entries where guild_id = current_setting('audit.m9_guild_a')::uuid) <> 1
  then raise exception 'Guild A leadership cannot see consented War Table context'; end if;
end $$;
reset role;

-- A leader of Guild B must see none of Guild A's rows.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m9_leader_b'), true);
do $$ begin
  if exists (select 1 from public.weekly_vault_progress where id = current_setting('audit.m9_vault')::uuid)
    or exists (select 1 from public.guild_vault_sharing where vault_progress_id = current_setting('audit.m9_vault')::uuid)
    or exists (select 1 from public.profiles where id = current_setting('audit.m9_member')::uuid)
    or exists (select 1 from public.guild_member_availability where guild_id = current_setting('audit.m9_guild_a')::uuid)
    or exists (select 1 from public.guild_calendar_entries where guild_id = current_setting('audit.m9_guild_a')::uuid)
  then raise exception 'Cross-Guild War Table context leaked'; end if;
end $$;
reset role;

-- The owner sees their own note and availability, but cannot directly write operational rows.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m9_member'), true);
do $$ begin
  if (select count(*) from public.weekly_vault_progress where id = current_setting('audit.m9_vault')::uuid) <> 1
    or (select count(*) from public.guild_member_availability where guild_id = current_setting('audit.m9_guild_a')::uuid) <> 1
    or (select count(*) from public.guild_calendar_entries where guild_id = current_setting('audit.m9_guild_a')::uuid) <> 1
    or has_table_privilege('authenticated', 'public.guild_member_availability', 'insert')
    or has_table_privilege('authenticated', 'public.guild_calendar_entries', 'insert')
  then raise exception 'Member War Table access or direct-write boundary failed'; end if;
end $$;
reset role;

select 'Milestone 9 synthetic RLS rehearsal passed; rolling back' as result;
rollback;
