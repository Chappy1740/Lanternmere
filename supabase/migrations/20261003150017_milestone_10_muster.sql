-- Milestone 10: applicant-owned submissions and claim-gated Guild recruitment.
-- Applicant details are never exposed through the public recruitment board.

alter table public.guild_member_roles drop constraint if exists guild_member_roles_role_check;
alter table public.guild_member_roles add constraint guild_member_roles_role_check
  check (role in ('guild_master', 'officer', 'raid_leader', 'loot_council', 'recruiter'));

create or replace function private.can_recruit_guild(p_guild_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_guild(p_guild_id)
      or private.has_guild_role(p_guild_id, 'recruiter');
$$;

create function private.has_active_guild_claim(p_guild_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guild_verified_claims claim
    where claim.guild_id = p_guild_id and claim.expires_at > now());
$$;

create or replace function public.set_guild_member_role(p_guild_member_id uuid, p_role text, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_members where id = p_guild_member_id;
  if v_actor is null or v_guild_id is null
    or p_role not in ('officer', 'raid_leader', 'loot_council', 'recruiter')
  then raise exception 'Invalid Guild role change' using errcode = '22023'; end if;
  if not private.has_guild_role(v_guild_id, 'guild_master')
    and not (private.has_guild_role(v_guild_id, 'officer')
      and p_role in ('raid_leader', 'loot_council', 'recruiter'))
  then raise exception 'Guild role change not permitted' using errcode = '42501'; end if;
  if p_enabled then
    insert into public.guild_member_roles (guild_member_id, role, granted_by)
    values (p_guild_member_id, p_role, v_actor) on conflict do nothing;
  else
    delete from public.guild_member_roles
    where guild_member_id = p_guild_member_id and role = p_role;
  end if;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.member_role_changed', 'guild_members',
    p_guild_member_id, jsonb_build_object('role', p_role, 'enabled', p_enabled));
end;
$$;

create table public.guild_recruitment_needs (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  raid_role text not null check (raid_role in ('tank', 'healer', 'damage', 'flex')),
  class_name text check (class_name is null or length(class_name) between 1 and 40),
  spec_name text check (spec_name is null or length(spec_name) between 1 and 40),
  slots integer not null default 1 check (slots between 1 and 20),
  description text not null default '' check (length(description) <= 500),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_guild_recruitment_needs_guild
  on public.guild_recruitment_needs(guild_id, active, created_at desc);
create trigger trg_guild_recruitment_needs_updated_at
  before update on public.guild_recruitment_needs
  for each row execute function private.set_updated_at();

create table public.guild_applications (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  applicant_profile_id uuid not null references public.profiles(id) on delete cascade,
  applicant_name text not null check (length(applicant_name) between 1 and 60),
  character_id uuid references public.characters(id) on delete set null,
  character_label text check (character_label is null or length(character_label) <= 180),
  raid_role text not null check (raid_role in ('tank', 'healer', 'damage', 'flex')),
  class_name text check (class_name is null or length(class_name) between 1 and 40),
  spec_name text check (spec_name is null or length(spec_name) between 1 and 40),
  availability text not null default '' check (length(availability) <= 500),
  experience text not null default '' check (length(experience) <= 1000),
  profile_url text check (profile_url is null or length(profile_url) <= 500 and profile_url ~ '^https://'),
  log_url text check (log_url is null or length(log_url) <= 500 and log_url ~ '^https://'),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'trial', 'accepted', 'declined', 'withdrawn')),
  trial_starts_on date,
  trial_ends_on date,
  trial_attendance_context text not null default '' check (length(trial_attendance_context) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_expires_at timestamptz not null default now() + interval '180 days',
  check (trial_ends_on is null or trial_starts_on is not null and trial_ends_on >= trial_starts_on),
  check (trial_starts_on is null or trial_ends_on is not null)
);
create unique index idx_guild_applications_one_active
  on public.guild_applications(guild_id, applicant_profile_id)
  where status in ('submitted', 'reviewing', 'trial');
create index idx_guild_applications_review
  on public.guild_applications(guild_id, status, created_at desc);
create index idx_guild_applications_retention
  on public.guild_applications(retention_expires_at);
create trigger trg_guild_applications_updated_at
  before update on public.guild_applications
  for each row execute function private.set_updated_at();

create table public.guild_application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.guild_applications(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  note text not null check (length(btrim(note)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index idx_guild_application_notes_application
  on public.guild_application_notes(application_id, created_at desc);

create table public.guild_application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.guild_applications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  decision_note text not null default '' check (length(decision_note) <= 1000),
  created_at timestamptz not null default now()
);
create index idx_guild_application_history_application
  on public.guild_application_history(application_id, created_at);

alter table public.guild_recruitment_needs enable row level security;
alter table public.guild_applications enable row level security;
alter table public.guild_application_notes enable row level security;
alter table public.guild_application_history enable row level security;
revoke all on public.guild_recruitment_needs, public.guild_applications,
  public.guild_application_notes, public.guild_application_history
  from public, anon, authenticated;
grant select on public.guild_recruitment_needs, public.guild_applications,
  public.guild_application_notes, public.guild_application_history to authenticated;

create policy guild_recruitment_needs_read on public.guild_recruitment_needs
  for select to authenticated using (
    (active and private.has_active_guild_claim(guild_id))
    or private.can_recruit_guild(guild_id)
  );
create policy guild_applications_read on public.guild_applications
  for select to authenticated using (
    applicant_profile_id = (select auth.uid()) or private.can_recruit_guild(guild_id)
  );
create policy guild_application_notes_read on public.guild_application_notes
  for select to authenticated using (exists (
    select 1 from public.guild_applications application
    where application.id = guild_application_notes.application_id
      and private.can_recruit_guild(application.guild_id)
  ));
create policy guild_application_history_read on public.guild_application_history
  for select to authenticated using (exists (
    select 1 from public.guild_applications application
    where application.id = guild_application_history.application_id
      and private.can_recruit_guild(application.guild_id)
  ));

create function public.recruiting_guild_name(p_guild_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select guild.name from public.guilds guild
  where (select auth.uid()) is not null and guild.id = p_guild_id
    and (
      (private.has_active_guild_claim(guild.id)
        and exists (select 1 from public.guild_recruitment_needs need
          where need.guild_id = guild.id and need.active))
      or exists (select 1 from public.guild_applications application
        where application.guild_id = guild.id
          and application.applicant_profile_id = (select auth.uid()))
    );
$$;

create function public.save_guild_recruitment_need(
  p_guild_id uuid, p_id uuid, p_raid_role text, p_class_name text,
  p_spec_name text, p_slots integer, p_description text, p_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null or not private.can_recruit_guild(p_guild_id) then
    raise exception 'Guild recruiter role required' using errcode = '42501';
  end if;
  if p_raid_role not in ('tank', 'healer', 'damage', 'flex') or p_slots not between 1 and 20
    or length(coalesce(p_class_name, '')) > 40 or length(coalesce(p_spec_name, '')) > 40
    or length(coalesce(p_description, '')) > 500 or p_active is null
  then raise exception 'Invalid recruitment need' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.guild_recruitment_needs
      (guild_id, raid_role, class_name, spec_name, slots, description, active, created_by)
    values (p_guild_id, p_raid_role, nullif(btrim(p_class_name), ''),
      nullif(btrim(p_spec_name), ''), p_slots, btrim(coalesce(p_description, '')),
      p_active, v_actor) returning id into v_id;
  else
    update public.guild_recruitment_needs
    set raid_role = p_raid_role, class_name = nullif(btrim(p_class_name), ''),
      spec_name = nullif(btrim(p_spec_name), ''), slots = p_slots,
      description = btrim(coalesce(p_description, '')), active = p_active
    where id = p_id and guild_id = p_guild_id returning id into v_id;
    if v_id is null then raise exception 'Recruitment need not found' using errcode = '22023'; end if;
  end if;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id, metadata)
  values (p_guild_id, v_actor, 'guild.recruitment_need_saved',
    'guild_recruitment_needs', v_id, jsonb_build_object('active', p_active));
  return v_id;
end;
$$;

create function public.submit_guild_application(
  p_guild_id uuid, p_character_id uuid, p_raid_role text,
  p_class_name text, p_spec_name text, p_availability text,
  p_experience text, p_profile_url text, p_log_url text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_id uuid; v_name text; v_character_label text;
begin
  if v_actor is null or not private.has_active_guild_claim(p_guild_id)
    or not exists (select 1 from public.guild_recruitment_needs
      where guild_id = p_guild_id and active)
    or private.is_guild_member(p_guild_id)
  then raise exception 'Guild application unavailable' using errcode = '42501'; end if;
  if (select count(*) from public.guild_applications
      where guild_id = p_guild_id and applicant_profile_id = v_actor
        and created_at > now() - interval '30 days') >= 3
  then raise exception 'Application limit reached' using errcode = '22023'; end if;
  if p_raid_role not in ('tank', 'healer', 'damage', 'flex')
    or length(coalesce(p_class_name, '')) > 40 or length(coalesce(p_spec_name, '')) > 40
    or length(coalesce(p_availability, '')) > 500
    or length(coalesce(p_experience, '')) > 1000
    or length(coalesce(p_profile_url, '')) > 500
    or length(coalesce(p_log_url, '')) > 500
    or (nullif(p_profile_url, '') is not null and p_profile_url !~ '^https://')
    or (nullif(p_log_url, '') is not null and p_log_url !~ '^https://')
    or (p_character_id is not null and not exists (
      select 1 from public.characters where id = p_character_id and profile_id = v_actor))
  then raise exception 'Invalid application details' using errcode = '22023'; end if;
  select display_name into v_name from public.profiles where id = v_actor;
  if v_name is null then raise exception 'Applicant profile missing' using errcode = '42501'; end if;
  if p_character_id is not null then
    select character_name || ' · ' || realm_slug into v_character_label
    from public.characters where id = p_character_id and profile_id = v_actor;
  end if;
  insert into public.guild_applications
    (guild_id, applicant_profile_id, applicant_name, character_id, character_label, raid_role,
      class_name, spec_name, availability, experience, profile_url, log_url)
  values (p_guild_id, v_actor, v_name, p_character_id, v_character_label, p_raid_role,
    nullif(btrim(p_class_name), ''), nullif(btrim(p_spec_name), ''),
    btrim(coalesce(p_availability, '')), btrim(coalesce(p_experience, '')),
    nullif(btrim(p_profile_url), ''), nullif(btrim(p_log_url), ''))
  returning id into v_id;
  insert into public.guild_application_history
    (application_id, actor_id, from_status, to_status)
  values (v_id, v_actor, null, 'submitted');
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (p_guild_id, v_actor, 'guild.application_submitted', 'guild_applications', v_id);
  return v_id;
end;
$$;

create function public.set_guild_application_stage(
  p_id uuid, p_status text, p_trial_starts_on date,
  p_trial_ends_on date, p_attendance_context text, p_decision_note text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_application public.guild_applications;
begin
  select * into v_application from public.guild_applications where id = p_id for update;
  if v_actor is null or v_application.id is null
    or not private.can_recruit_guild(v_application.guild_id)
  then raise exception 'Guild recruiter role required' using errcode = '42501'; end if;
  if v_application.status in ('accepted', 'declined', 'withdrawn')
    or p_status not in ('reviewing', 'trial', 'accepted', 'declined')
    or length(coalesce(p_attendance_context, '')) > 1000
    or length(coalesce(p_decision_note, '')) > 1000
  then raise exception 'Invalid application stage' using errcode = '22023'; end if;
  if (v_application.status = 'submitted' and p_status not in ('reviewing', 'trial', 'declined'))
    or (v_application.status = 'reviewing' and p_status not in ('trial', 'declined'))
    or (v_application.status = 'trial' and p_status not in ('trial', 'accepted', 'declined'))
  then raise exception 'Invalid application transition' using errcode = '22023'; end if;
  if p_status in ('accepted', 'declined')
    and not private.can_manage_guild(v_application.guild_id)
  then raise exception 'Officer decision required' using errcode = '42501'; end if;
  if p_status = 'trial' and
    (p_trial_starts_on is null or p_trial_ends_on is null
      or p_trial_ends_on < p_trial_starts_on or p_trial_ends_on > p_trial_starts_on + 90)
  then raise exception 'Trial dates required' using errcode = '22023'; end if;
  if p_status in ('accepted', 'declined') and length(btrim(coalesce(p_decision_note, ''))) < 5
  then raise exception 'Decision note required' using errcode = '22023'; end if;
  update public.guild_applications
  set status = p_status,
    trial_starts_on = case when p_status = 'trial' then p_trial_starts_on else trial_starts_on end,
    trial_ends_on = case when p_status = 'trial' then p_trial_ends_on else trial_ends_on end,
    trial_attendance_context = case when p_status = 'trial'
      then btrim(coalesce(p_attendance_context, '')) else trial_attendance_context end,
    retention_expires_at = case when p_status in ('accepted', 'declined')
      then now() + interval '90 days' else now() + interval '180 days' end
  where id = p_id;
  insert into public.guild_application_history
    (application_id, actor_id, from_status, to_status, decision_note)
  values (p_id, v_actor, v_application.status, p_status,
    case when p_status in ('accepted', 'declined')
      then btrim(p_decision_note) else '' end);
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_application.guild_id, v_actor, 'guild.application_stage_changed',
    'guild_applications', p_id, jsonb_build_object('status', p_status));
end;
$$;

create function public.add_guild_application_note(p_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
  select guild_id into v_guild_id from public.guild_applications where id = p_id;
  if v_actor is null or v_guild_id is null or not private.can_recruit_guild(v_guild_id)
  then raise exception 'Guild recruiter role required' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_note, ''))) not between 1 and 1000
  then raise exception 'Invalid officer note' using errcode = '22023'; end if;
  insert into public.guild_application_notes (application_id, author_id, note)
  values (p_id, v_actor, btrim(p_note)) returning id into v_id;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (v_guild_id, v_actor, 'guild.application_note_added',
    'guild_application_notes', v_id);
  return v_id;
end;
$$;

create function public.delete_guild_application(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_application public.guild_applications;
begin
  select * into v_application from public.guild_applications where id = p_id for update;
  if v_actor is null or v_application.id is null
    or (v_application.applicant_profile_id <> v_actor
      and not private.has_guild_role(v_application.guild_id, 'guild_master'))
  then raise exception 'Application deletion not permitted' using errcode = '42501'; end if;
  update public.guild_audit_events set actor_id = null
  where target_table = 'guild_applications' and target_id = p_id
    and action = 'guild.application_submitted';
  delete from public.guild_applications where id = p_id;
  insert into public.guild_audit_events
    (guild_id, actor_id, action, target_table, target_id)
  values (v_application.guild_id,
    case when v_application.applicant_profile_id = v_actor then null else v_actor end,
    'guild.application_deleted',
    'guild_applications', p_id);
end;
$$;

create function private.purge_expired_guild_applications()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  update public.guild_audit_events audit set actor_id = null
  from public.guild_applications application
  where application.retention_expires_at <= now()
    and audit.target_table = 'guild_applications'
    and audit.target_id = application.id
    and audit.action = 'guild.application_submitted';
  delete from public.guild_applications where retention_expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function private.purge_expired_guild_applications() from public, anon, authenticated;

revoke all on function public.recruiting_guild_name(uuid) from public, anon;
revoke all on function public.save_guild_recruitment_need(uuid, uuid, text, text, text, integer, text, boolean) from public, anon;
revoke all on function public.submit_guild_application(uuid, uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.set_guild_application_stage(uuid, text, date, date, text, text) from public, anon;
revoke all on function public.add_guild_application_note(uuid, text) from public, anon;
revoke all on function public.delete_guild_application(uuid) from public, anon;
grant execute on function public.recruiting_guild_name(uuid) to authenticated;
grant execute on function public.save_guild_recruitment_need(uuid, uuid, text, text, text, integer, text, boolean) to authenticated;
grant execute on function public.submit_guild_application(uuid, uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_guild_application_stage(uuid, text, date, date, text, text) to authenticated;
grant execute on function public.add_guild_application_note(uuid, text) to authenticated;
grant execute on function public.delete_guild_application(uuid) to authenticated;

-- Daily deletion bounds applicant data even if no one opens the recruitment page.
create extension if not exists pg_cron;
select cron.schedule('lanternmere-muster-retention', '15 4 * * *',
  'select private.purge_expired_guild_applications()');
