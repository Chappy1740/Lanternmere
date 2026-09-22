-- A Guild Master transfer is a two-person, time-bounded consent flow. It does
-- not infer ownership from a Blizzard roster rank and it never grants a Lodge
-- role or changes Traveler ownership.
create table public.guild_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  from_member_id uuid not null references public.guild_members(id) on delete restrict,
  to_member_id uuid not null references public.guild_members(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  canceled_at timestamptz,
  canceled_by uuid references public.profiles(id),
  check (from_member_id <> to_member_id),
  check ((accepted_at is null) = (accepted_by is null)),
  check ((canceled_at is null) = (canceled_by is null))
);

-- Pending transfers are serial: a Guild cannot have competing ownership offers.
create unique index guild_ownership_transfers_one_pending_per_guild
  on public.guild_ownership_transfers(guild_id)
  where accepted_at is null and canceled_at is null;

alter table public.guild_ownership_transfers enable row level security;
revoke all on public.guild_ownership_transfers from anon;
grant select on public.guild_ownership_transfers to authenticated;

create policy "guild_ownership_transfers_select_master_or_recipient"
  on public.guild_ownership_transfers for select to authenticated using (
    private.has_guild_role(guild_id, 'guild_master')
    or exists (
      select 1 from public.guild_members recipient
      where recipient.id = to_member_id
        and recipient.profile_id = (select auth.uid())
    )
  );

-- Raw role writes cannot create a second Guild Master. The only path to the
-- Guild Master role below is the locked, consented transfer function.
drop policy "guild_member_roles_grant_master_or_limited_officer" on public.guild_member_roles;
create policy "guild_member_roles_grant_nonmaster_roles"
  on public.guild_member_roles for insert to authenticated with check (
    role <> 'guild_master'
    and exists (
      select 1 from public.guild_members member
      where member.id = guild_member_id
        and (
          private.has_guild_role(member.guild_id, 'guild_master')
          or (private.has_guild_role(member.guild_id, 'officer') and role in ('raid_leader', 'loot_council'))
        )
    )
  );

create or replace function public.request_guild_ownership_transfer(p_to_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_from_member_id uuid;
  v_guild_id uuid;
  v_transfer_id uuid;
begin
  if v_actor is null then
    raise exception 'request_guild_ownership_transfer: authentication required' using errcode = '42501';
  end if;

  select member.id, member.guild_id into v_from_member_id, v_guild_id
  from public.guild_members member
  join public.guild_member_roles member_role on member_role.guild_member_id = member.id
  where member.profile_id = v_actor and member_role.role = 'guild_master'
  for update of member;

  if v_from_member_id is null then
    raise exception 'request_guild_ownership_transfer: Guild Master required' using errcode = '42501';
  end if;
  if p_to_member_id = v_from_member_id or not exists (
    select 1 from public.guild_members member
    where member.id = p_to_member_id and member.guild_id = v_guild_id
  ) then
    raise exception 'request_guild_ownership_transfer: recipient must be another Guild member' using errcode = '22023';
  end if;

  update public.guild_ownership_transfers
  set canceled_at = now(), canceled_by = v_actor
  where guild_id = v_guild_id and accepted_at is null and canceled_at is null;

  insert into public.guild_ownership_transfers (
    guild_id, from_member_id, to_member_id, initiated_by, expires_at
  ) values (
    v_guild_id, v_from_member_id, p_to_member_id, v_actor, now() + interval '7 days'
  ) returning id into v_transfer_id;

  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.ownership_transfer_requested', 'guild_ownership_transfers', v_transfer_id,
    jsonb_build_object('to_member_id', p_to_member_id));
  return v_transfer_id;
end;
$$;

create or replace function public.cancel_guild_ownership_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_ownership_transfers where id = p_transfer_id for update;
  if v_actor is null or v_guild_id is null or not private.has_guild_role(v_guild_id, 'guild_master') then
    raise exception 'cancel_guild_ownership_transfer: Guild Master required' using errcode = '42501';
  end if;
  update public.guild_ownership_transfers set canceled_at = now(), canceled_by = v_actor
  where id = p_transfer_id and accepted_at is null and canceled_at is null;
  if found then
    insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
    values (v_guild_id, v_actor, 'guild.ownership_transfer_canceled', 'guild_ownership_transfers', p_transfer_id);
  end if;
end;
$$;

create or replace function public.accept_guild_ownership_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_transfer public.guild_ownership_transfers;
  v_current_master_id uuid;
begin
  if v_actor is null then
    raise exception 'accept_guild_ownership_transfer: authentication required' using errcode = '42501';
  end if;
  select * into v_transfer from public.guild_ownership_transfers
  where id = p_transfer_id and accepted_at is null and canceled_at is null and expires_at > now()
  for update;
  if not found or not exists (
    select 1 from public.guild_members recipient
    where recipient.id = v_transfer.to_member_id and recipient.profile_id = v_actor
  ) then
    raise exception 'accept_guild_ownership_transfer: transfer is unavailable' using errcode = '42501';
  end if;
  select member.id into v_current_master_id
  from public.guild_members member
  join public.guild_member_roles member_role on member_role.guild_member_id = member.id
  where member.guild_id = v_transfer.guild_id and member_role.role = 'guild_master'
  for update of member;
  if v_current_master_id is distinct from v_transfer.from_member_id then
    raise exception 'accept_guild_ownership_transfer: Guild Master changed' using errcode = '40001';
  end if;

  delete from public.guild_member_roles
  where guild_member_id = v_transfer.from_member_id and role = 'guild_master';
  insert into public.guild_member_roles (guild_member_id, role, granted_by)
  values (v_transfer.to_member_id, 'guild_master', v_actor);
  update public.guild_ownership_transfers
  set accepted_at = now(), accepted_by = v_actor
  where id = v_transfer.id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_transfer.guild_id, v_actor, 'guild.ownership_transfer_accepted', 'guild_ownership_transfers', v_transfer.id,
    jsonb_build_object('from_member_id', v_transfer.from_member_id));
  return v_transfer.guild_id;
end;
$$;

revoke all on function public.request_guild_ownership_transfer(uuid) from public, anon;
revoke all on function public.cancel_guild_ownership_transfer(uuid) from public, anon;
revoke all on function public.accept_guild_ownership_transfer(uuid) from public, anon;
grant execute on function public.request_guild_ownership_transfer(uuid) to authenticated;
grant execute on function public.cancel_guild_ownership_transfer(uuid) to authenticated;
grant execute on function public.accept_guild_ownership_transfer(uuid) to authenticated;
