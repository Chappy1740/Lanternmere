-- Availability is Guild-operational context. It neither reads nor changes a
-- Lodge event RSVP, and is visible only to its owner and Guild leadership.
create table public.guild_member_availability (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  availability_status text not null check (availability_status in ('available', 'tentative', 'unavailable')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (ends_on <= starts_on + 366)
);

create index idx_guild_member_availability_guild_dates
  on public.guild_member_availability(guild_id, starts_on, ends_on);
create index idx_guild_member_availability_profile_dates
  on public.guild_member_availability(profile_id, starts_on, ends_on);

create trigger trg_guild_member_availability_updated_at
  before update on public.guild_member_availability
  for each row execute function private.set_updated_at();

create or replace function public.create_guild_member_availability(
  p_guild_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_availability_status text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
begin
  if v_actor is null or not private.is_guild_member(p_guild_id) then
    raise exception 'Guild membership required' using errcode = '42501';
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on
    or p_ends_on > p_starts_on + 366
    or p_availability_status not in ('available', 'tentative', 'unavailable')
    or p_note is not null and length(p_note) > 500 then
    raise exception 'Invalid availability period' using errcode = '22023';
  end if;

  insert into public.guild_member_availability (
    guild_id, profile_id, starts_on, ends_on, availability_status, note
  ) values (
    p_guild_id, v_actor, p_starts_on, p_ends_on, p_availability_status, nullif(btrim(p_note), '')
  ) returning id into v_id;

  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (
    p_guild_id, v_actor, 'guild.member_availability_created', 'guild_member_availability', v_id,
    jsonb_build_object('starts_on', p_starts_on, 'ends_on', p_ends_on, 'availability_status', p_availability_status)
  );
  return v_id;
end;
$$;

alter table public.guild_member_availability enable row level security;
revoke all on public.guild_member_availability from anon, authenticated;
grant select on public.guild_member_availability to authenticated;
create policy "guild_member_availability_select_owner_or_leadership"
  on public.guild_member_availability for select to authenticated
  using (profile_id = (select auth.uid()) or private.can_lead_guild(guild_id));

revoke all on function public.create_guild_member_availability(uuid, date, date, text, text) from public, anon;
grant execute on function public.create_guild_member_availability(uuid, date, date, text, text) to authenticated;
