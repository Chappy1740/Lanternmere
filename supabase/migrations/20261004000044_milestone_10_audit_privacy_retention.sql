-- Milestone 10 audit: protect recruiter identity and private trial context,
-- and keep active application retention anchored to the original submission.

-- RLS chooses rows, not columns. Public needs may be read by any signed-in
-- viewer, so the recruiter's profile id must not have a table-wide grant.
revoke select on public.guild_recruitment_needs from authenticated;
grant select (id, guild_id, raid_role, class_name, spec_name, slots,
  description, active, created_at) on public.guild_recruitment_needs to authenticated;

-- Applicants retain their own application rows, but leadership's attendance
-- context is fetched through the verified-recruiter RPC below.
revoke select on public.guild_applications from authenticated;
grant select (id, guild_id, applicant_profile_id, applicant_name, character_id,
  character_label, raid_role, class_name, spec_name, availability, experience,
  profile_url, log_url, status, trial_starts_on, trial_ends_on, created_at,
  retention_expires_at) on public.guild_applications to authenticated;

create function public.get_guild_trial_attendance_contexts(
  p_guild_id uuid, p_application_ids uuid[]
)
returns table(application_id uuid, attendance_context text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.can_recruit_guild(p_guild_id)
    or p_application_ids is null or cardinality(p_application_ids) not between 1 and 50
  then raise exception 'Guild recruiter role required' using errcode = '42501'; end if;
  return query
    select application.id, application.trial_attendance_context
    from public.guild_applications application
    where application.guild_id = p_guild_id
      and application.id = any(p_application_ids)
      and application.trial_attendance_context <> '';
end;
$$;
revoke all on function public.get_guild_trial_attendance_contexts(uuid, uuid[])
  from public, anon;
grant execute on function public.get_guild_trial_attendance_contexts(uuid, uuid[])
  to authenticated;

create function private.cap_guild_application_retention()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('submitted', 'reviewing', 'trial') then
    new.retention_expires_at := least(new.retention_expires_at,
      old.retention_expires_at, new.created_at + interval '180 days');
  end if;
  return new;
end;
$$;
revoke all on function private.cap_guild_application_retention() from public, anon, authenticated;
create trigger trg_cap_guild_application_retention
  before update on public.guild_applications
  for each row execute function private.cap_guild_application_retention();

-- Earlier stage saves may already have moved active deadlines. Restore the cap.
update public.guild_applications
set retention_expires_at = least(retention_expires_at, created_at + interval '180 days')
where status in ('submitted', 'reviewing', 'trial')
  and retention_expires_at > created_at + interval '180 days';
