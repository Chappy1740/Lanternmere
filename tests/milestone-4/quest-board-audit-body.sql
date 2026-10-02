-- Current-schema audit fixture. Run inside one transaction and roll it back.
select set_config('audit.owner', gen_random_uuid()::text, true);
select set_config('audit.member', gen_random_uuid()::text, true);
select set_config('audit.lodge', gen_random_uuid()::text, true);
select set_config('audit.event', gen_random_uuid()::text, true);
select set_config('audit.delete_event', gen_random_uuid()::text, true);
select set_config('audit.raid_event', gen_random_uuid()::text, true);
select set_config('audit.guild', gen_random_uuid()::text, true);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  (current_setting('audit.owner')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm4-owner-' || current_setting('audit.owner') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditOwner"}'::jsonb),
  (current_setting('audit.member')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm4-member-' || current_setting('audit.member') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditMember"}'::jsonb);

insert into public.lodges (id, name, slug, created_by)
values (current_setting('audit.lodge')::uuid, 'M4 Audit Lodge',
  'm4-audit-' || current_setting('audit.lodge'), current_setting('audit.owner')::uuid);
insert into public.lodge_members (lodge_id, profile_id, role)
values
  (current_setting('audit.lodge')::uuid, current_setting('audit.owner')::uuid, 'owner'),
  (current_setting('audit.lodge')::uuid, current_setting('audit.member')::uuid, 'member');
insert into public.events (id, lodge_id, created_by, title, event_date)
values
  (current_setting('audit.event')::uuid, current_setting('audit.lodge')::uuid,
    current_setting('audit.member')::uuid, 'Member event', current_date + 1),
  (current_setting('audit.delete_event')::uuid, current_setting('audit.lodge')::uuid,
    current_setting('audit.member')::uuid, 'Removable event', current_date + 1),
  (current_setting('audit.raid_event')::uuid, current_setting('audit.lodge')::uuid,
    current_setting('audit.owner')::uuid, 'Guild raid event', current_date + 1);
insert into public.event_attendees (event_id, profile_id, rsvp_status, role)
values
  (current_setting('audit.event')::uuid, current_setting('audit.member')::uuid, 'confirmed', 'tank'),
  (current_setting('audit.delete_event')::uuid, current_setting('audit.member')::uuid, 'confirmed', 'tank'),
  (current_setting('audit.raid_event')::uuid, current_setting('audit.owner')::uuid, 'confirmed', 'healer');
insert into public.guilds (id, name, slug, created_by)
values (current_setting('audit.guild')::uuid, 'M4 Audit Guild',
  'm4-audit-' || current_setting('audit.guild'), current_setting('audit.owner')::uuid);
insert into public.guild_raid_operations (guild_id, event_id, authorized_by)
values (current_setting('audit.guild')::uuid, current_setting('audit.raid_event')::uuid,
  current_setting('audit.owner')::uuid);

do $$
begin
  begin
    delete from public.events where id = current_setting('audit.raid_event')::uuid;
    raise exception 'Guild-linked event deletion unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;
  if not exists (select 1 from public.guild_raid_operations
      where event_id = current_setting('audit.raid_event')::uuid)
    or not exists (select 1 from public.event_attendees
      where event_id = current_setting('audit.raid_event')::uuid)
  then raise exception 'Guild operation or RSVP was lost'; end if;
end;
$$;

-- Current creators can still delete an unlinked event and its RSVP.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.member'), true);
do $$
declare v_deleted integer;
begin
  delete from public.events where id = current_setting('audit.delete_event')::uuid;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'Current event creator could not delete'; end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.event_attendees
    where event_id = current_setting('audit.delete_event')::uuid)
  then raise exception 'Deleted event RSVP survived'; end if;
end;
$$;

-- Membership deletion must remove only the departing member's RSVP.
delete from public.lodge_members
where lodge_id = current_setting('audit.lodge')::uuid
  and profile_id = current_setting('audit.member')::uuid;
do $$
begin
  if exists (select 1 from public.event_attendees
      where event_id = current_setting('audit.event')::uuid)
    or not exists (select 1 from public.event_attendees
      where event_id = current_setting('audit.raid_event')::uuid)
  then raise exception 'Membership-exit RSVP cleanup was not scoped'; end if;
end;
$$;

-- Simulate a direct authenticated API request from the former event creator.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.member'), true);
do $$
declare v_deleted integer;
begin
  delete from public.events where id = current_setting('audit.event')::uuid;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then raise exception 'Former member deleted a Lodge event'; end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.events where id = current_setting('audit.event')::uuid)
  then raise exception 'Former member event disappeared'; end if;
end;
$$;

-- Constraints reject direct writes outside the action's valid content.
do $$
begin
  begin
    update public.events set title = '   ' where id = current_setting('audit.event')::uuid;
    raise exception 'Blank event title unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    update public.event_attendees set role = 'leader'
    where event_id = current_setting('audit.raid_event')::uuid;
    raise exception 'Invalid RSVP role unexpectedly accepted';
  exception when check_violation then null;
  end;
end;
$$;
