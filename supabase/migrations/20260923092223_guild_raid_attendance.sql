-- Attendance is Guild-owned operational context. It intentionally does not
-- update or mirror the canonical Quest Board RSVP record.
create table public.guild_raid_attendance (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.guild_raid_operations(id) on delete cascade,
  guild_member_id uuid not null references public.guild_members(id) on delete cascade,
  attendance_status text not null check (attendance_status in ('invited', 'confirmed', 'attended', 'late', 'absent', 'benched')),
  context_note text not null default '' check (length(context_note) <= 1000),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_id, guild_member_id)
);

create index idx_guild_raid_attendance_operation on public.guild_raid_attendance(operation_id, attendance_status);

create trigger trg_guild_raid_attendance_updated_at
  before update on public.guild_raid_attendance
  for each row execute function private.set_updated_at();

create or replace function public.set_guild_raid_attendance(
  p_operation_id uuid, p_guild_member_id uuid, p_attendance_status text, p_context_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  if p_attendance_status not in ('invited', 'confirmed', 'attended', 'late', 'absent', 'benched') or p_context_note is null or length(p_context_note) > 1000 then
    raise exception 'Invalid attendance record' using errcode = '22023';
  end if;
  if not exists (select 1 from public.guild_members where id = p_guild_member_id and guild_id = v_guild_id) then
    raise exception 'Guild member is unavailable' using errcode = '42501';
  end if;
  insert into public.guild_raid_attendance (operation_id, guild_member_id, attendance_status, context_note, recorded_by)
  values (p_operation_id, p_guild_member_id, p_attendance_status, p_context_note, v_actor)
  on conflict (operation_id, guild_member_id) do update
    set attendance_status = excluded.attendance_status, context_note = excluded.context_note,
      recorded_by = excluded.recorded_by, recorded_at = now();
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.raid_attendance_recorded', 'guild_raid_attendance', p_operation_id,
    jsonb_build_object('guild_member_id', p_guild_member_id, 'attendance_status', p_attendance_status));
end;
$$;

alter table public.guild_raid_attendance enable row level security;
revoke all on public.guild_raid_attendance from anon, authenticated;
grant select on public.guild_raid_attendance to authenticated;
create policy "guild_raid_attendance_select_leadership" on public.guild_raid_attendance for select to authenticated
  using (private.can_manage_guild_raid_operation(operation_id));

revoke all on function public.set_guild_raid_attendance(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_guild_raid_attendance(uuid, uuid, text, text) to authenticated;
