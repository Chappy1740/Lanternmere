-- Current-schema fixture body. Run inside BEGIN ... ROLLBACK; never run alone.
-- All users, Guilds, applications, and notes below are synthetic.
select set_config('audit.m10_master', gen_random_uuid()::text, true);
select set_config('audit.m10_recruiter', gen_random_uuid()::text, true);
select set_config('audit.m10_applicant', gen_random_uuid()::text, true);
select set_config('audit.m10_other', gen_random_uuid()::text, true);
select set_config('audit.m10_guild', gen_random_uuid()::text, true);
select set_config('audit.m10_other_guild', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm10-' || id || '@example.invalid', '', now(), now(), now(),
  jsonb_build_object('display_name', label)
from (values
  (current_setting('audit.m10_master')::uuid, 'AuditMaster'),
  (current_setting('audit.m10_recruiter')::uuid, 'AuditRecruiter'),
  (current_setting('audit.m10_applicant')::uuid, 'AuditApplicant'),
  (current_setting('audit.m10_other')::uuid, 'AuditOther')
) as people(id, label);

insert into public.guilds (id, name, slug, created_by)
values (current_setting('audit.m10_guild')::uuid, 'M10 Audit Guild',
    'm10-a-' || current_setting('audit.m10_guild'), current_setting('audit.m10_master')::uuid),
  (current_setting('audit.m10_other_guild')::uuid, 'M10 Other Guild',
    'm10-b-' || current_setting('audit.m10_other_guild'), current_setting('audit.m10_other')::uuid);
insert into public.guild_members (guild_id, profile_id)
values (current_setting('audit.m10_guild')::uuid, current_setting('audit.m10_master')::uuid),
  (current_setting('audit.m10_guild')::uuid, current_setting('audit.m10_recruiter')::uuid),
  (current_setting('audit.m10_other_guild')::uuid, current_setting('audit.m10_other')::uuid);
insert into public.guild_verified_claims
  (guild_id, profile_id, blizzard_character_id, region, realm_slug, guild_name, claimed_at, expires_at)
values (current_setting('audit.m10_guild')::uuid, current_setting('audit.m10_master')::uuid,
    10000001, 'us', 'stormrage', 'M10 Audit Guild', now() - interval '1 minute', now() + interval '1 day'),
  (current_setting('audit.m10_other_guild')::uuid, current_setting('audit.m10_other')::uuid,
    10000002, 'us', 'stormrage', 'M10 Other Guild', now() - interval '1 minute', now() + interval '1 day');
insert into public.guild_member_roles (guild_member_id, role, granted_by)
select id, case when profile_id = current_setting('audit.m10_recruiter')::uuid
  then 'recruiter' else 'guild_master' end,
  current_setting('audit.m10_master')::uuid
from public.guild_members where guild_id = current_setting('audit.m10_guild')::uuid;
insert into public.guild_member_roles (guild_member_id, role, granted_by)
select id, 'guild_master', current_setting('audit.m10_other')::uuid
from public.guild_members where guild_id = current_setting('audit.m10_other_guild')::uuid;

-- The verified Guild recruiter can post an open need.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_recruiter'), true);
select set_config('audit.m10_need', public.save_guild_recruitment_need(
  current_setting('audit.m10_guild')::uuid, null, 'healer', null, null, 1,
  'Synthetic recruitment need', true)::text, true);
reset role;

-- A signed-in nonmember can see only the posted need and submit their own application.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_applicant'), true);
do $$ begin
  if (select count(*) from public.guild_recruitment_needs
      where guild_id = current_setting('audit.m10_guild')::uuid) <> 1
    or public.recruiting_guild_name(current_setting('audit.m10_guild')::uuid) <> 'M10 Audit Guild'
    or exists (select 1 from public.guild_recruitment_needs
      where guild_id = current_setting('audit.m10_other_guild')::uuid)
  then raise exception 'Applicant board visibility failed'; end if;
end $$;
select set_config('audit.m10_application', public.submit_guild_application(
  current_setting('audit.m10_guild')::uuid, null, 'healer', null, null,
  'Wednesday evenings', 'Synthetic experience for rehearsal', null, null)::text, true);
do $$ begin
  if (select count(*) from public.guild_applications
      where id = current_setting('audit.m10_application')::uuid) <> 1
    or has_table_privilege('authenticated', 'public.guild_applications', 'insert')
    or has_table_privilege('authenticated', 'public.guild_application_notes', 'insert')
  then raise exception 'Applicant ownership or direct-write boundary failed'; end if;
end $$;
reset role;

-- Recruiters can review and note; they cannot make final decisions.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_recruiter'), true);
select public.add_guild_application_note(current_setting('audit.m10_application')::uuid,
  'Private synthetic note');
select public.set_guild_application_stage(current_setting('audit.m10_application')::uuid,
  'trial', current_date, current_date + 14, 'Manual trial context', '');
do $$ begin
  begin
    perform public.set_guild_application_stage(current_setting('audit.m10_application')::uuid,
      'accepted', null, null, '', 'Officer decision only');
    raise exception 'Recruiter made a final decision';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.guild_application_notes
      where application_id = current_setting('audit.m10_application')::uuid) <> 1
  then raise exception 'Recruiter note unavailable'; end if;
end $$;
reset role;

-- Applicant must not read private notes or internal decision history.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_applicant'), true);
do $$ begin
  if exists (select 1 from public.guild_application_notes
      where application_id = current_setting('audit.m10_application')::uuid)
    or exists (select 1 from public.guild_application_history
      where application_id = current_setting('audit.m10_application')::uuid)
  then raise exception 'Private recruitment review leaked to applicant'; end if;
end $$;
reset role;

-- A different Guild Master cannot see this application or its private review.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_other'), true);
do $$ begin
  if exists (select 1 from public.guild_applications
      where id = current_setting('audit.m10_application')::uuid)
    or exists (select 1 from public.guild_application_notes
      where application_id = current_setting('audit.m10_application')::uuid)
  then raise exception 'Cross-Guild application leak'; end if;
end $$;
reset role;

-- The verified Guild Master can decide, and retention deletion cascades review data.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_master'), true);
select public.set_guild_application_stage(current_setting('audit.m10_application')::uuid,
  'accepted', null, null, '', 'Approved by synthetic Guild Master');
reset role;
do $$ begin
  if (select status from public.guild_applications
      where id = current_setting('audit.m10_application')::uuid) <> 'accepted'
    or (select count(*) from public.guild_application_history
      where application_id = current_setting('audit.m10_application')::uuid) <> 3
  then raise exception 'Decision history failed'; end if;
end $$;
update public.guild_applications set retention_expires_at = now() - interval '1 minute'
where id = current_setting('audit.m10_application')::uuid;
select private.purge_expired_guild_applications();
do $$ begin
  if exists (select 1 from public.guild_applications
      where id = current_setting('audit.m10_application')::uuid)
    or exists (select 1 from public.guild_application_notes
      where application_id = current_setting('audit.m10_application')::uuid)
    or exists (select 1 from public.guild_application_history
      where application_id = current_setting('audit.m10_application')::uuid)
  then raise exception 'Expired private application data survived purge'; end if;
end $$;
-- A fresh applicant-owned application can be removed without leaving its identity in audit.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.m10_applicant'), true);
select set_config('audit.m10_deleted_application', public.submit_guild_application(
  current_setting('audit.m10_guild')::uuid, null, 'damage', null, null,
  'Saturday evenings', 'Synthetic deletion rehearsal', null, null)::text, true);
select public.delete_guild_application(current_setting('audit.m10_deleted_application')::uuid);
reset role;
do $$ begin
  if exists (select 1 from public.guild_applications
      where id = current_setting('audit.m10_deleted_application')::uuid)
    or exists (select 1 from public.guild_audit_events
      where target_table = 'guild_applications'
        and target_id = current_setting('audit.m10_deleted_application')::uuid
        and actor_id is not null)
  then raise exception 'Applicant deletion or audit anonymization failed'; end if;
end $$;
select 'Milestone 10 synthetic recruitment checks passed; caller must roll back' as result;
