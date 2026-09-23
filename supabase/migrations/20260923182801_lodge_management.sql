-- Lodge management is deliberately routed through narrow, authenticated RPCs.
-- Ownership changes require the recipient's explicit acceptance; an owner can
-- otherwise delete the entire Lodge only after typing its exact name.

create table public.lodge_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  from_membership_id uuid not null references public.lodge_members(id) on delete restrict,
  to_membership_id uuid not null references public.lodge_members(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  canceled_at timestamptz,
  canceled_by uuid references public.profiles(id),
  check (from_membership_id <> to_membership_id),
  check ((accepted_at is null) = (accepted_by is null)),
  check ((canceled_at is null) = (canceled_by is null))
);

create unique index lodge_ownership_transfers_one_pending_per_lodge
  on public.lodge_ownership_transfers(lodge_id)
  where accepted_at is null and canceled_at is null;

alter table public.lodge_ownership_transfers enable row level security;
revoke all on public.lodge_ownership_transfers from public, anon, authenticated;
grant select on public.lodge_ownership_transfers to authenticated;

create policy "lodge_ownership_transfers_select_participants"
  on public.lodge_ownership_transfers for select to authenticated using (
    exists (
      select 1 from public.lodge_members member
      where member.id in (from_membership_id, to_membership_id)
        and member.profile_id = (select auth.uid())
    )
  );

create or replace function public.request_lodge_ownership_transfer(p_to_membership_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_from public.lodge_members;
  v_to public.lodge_members;
  v_transfer_id uuid;
begin
  select * into v_from from public.lodge_members
  where profile_id = v_actor and role = 'owner' for update;
  if v_actor is null or not found then
    raise exception 'request_lodge_ownership_transfer: Lodge owner required' using errcode = '42501';
  end if;
  select * into v_to from public.lodge_members
  where id = p_to_membership_id and lodge_id = v_from.lodge_id and role <> 'owner' for update;
  if not found then
    raise exception 'request_lodge_ownership_transfer: recipient must be another Lodge member' using errcode = '22023';
  end if;
  update public.lodge_ownership_transfers set canceled_at = now(), canceled_by = v_actor
  where lodge_id = v_from.lodge_id and accepted_at is null and canceled_at is null;
  insert into public.lodge_ownership_transfers (lodge_id, from_membership_id, to_membership_id, initiated_by, expires_at)
  values (v_from.lodge_id, v_from.id, v_to.id, v_actor, now() + interval '7 days') returning id into v_transfer_id;
  insert into public.audit_events (lodge_id, actor_id, action, target_table, target_id)
  values (v_from.lodge_id, v_actor, 'lodge.ownership_transfer_requested', 'lodge_ownership_transfers', v_transfer_id);
  return v_transfer_id;
end;
$$;

create or replace function public.accept_lodge_ownership_transfer(p_transfer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_transfer public.lodge_ownership_transfers;
begin
  select * into v_transfer from public.lodge_ownership_transfers
  where id = p_transfer_id and accepted_at is null and canceled_at is null and expires_at > now() for update;
  if v_actor is null or not found or not exists (
    select 1 from public.lodge_members where id = v_transfer.to_membership_id and profile_id = v_actor
  ) then raise exception 'accept_lodge_ownership_transfer: transfer unavailable' using errcode = '42501'; end if;
  update public.lodge_members set role = 'member' where id = v_transfer.from_membership_id and role = 'owner';
  if not found then raise exception 'accept_lodge_ownership_transfer: owner changed' using errcode = '40001'; end if;
  update public.lodge_members set role = 'owner' where id = v_transfer.to_membership_id;
  update public.lodge_ownership_transfers set accepted_at = now(), accepted_by = v_actor where id = v_transfer.id;
  insert into public.audit_events (lodge_id, actor_id, action, target_table, target_id)
  values (v_transfer.lodge_id, v_actor, 'lodge.ownership_transfer_accepted', 'lodge_ownership_transfers', v_transfer.id);
  return v_transfer.lodge_id;
end;
$$;

create or replace function public.cancel_lodge_ownership_transfer(p_transfer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_transfer public.lodge_ownership_transfers;
begin
  select * into v_transfer from public.lodge_ownership_transfers where id = p_transfer_id for update;
  if v_actor is null or not found or not exists (
    select 1 from public.lodge_members where id = v_transfer.from_membership_id and profile_id = v_actor and role = 'owner'
  ) then raise exception 'cancel_lodge_ownership_transfer: Lodge owner required' using errcode = '42501'; end if;
  update public.lodge_ownership_transfers set canceled_at = now(), canceled_by = v_actor
  where id = v_transfer.id and accepted_at is null and canceled_at is null;
end;
$$;

create or replace function public.leave_lodge(p_lodge_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_membership public.lodge_members;
begin
  select * into v_membership from public.lodge_members where lodge_id = p_lodge_id and profile_id = v_actor for update;
  if v_actor is null or not found then raise exception 'leave_lodge: membership required' using errcode = '42501'; end if;
  if v_membership.role = 'owner' then raise exception 'leave_lodge: transfer ownership or delete the Lodge first' using errcode = '42501'; end if;
  delete from public.character_lodges using public.characters
  where character_lodges.lodge_id = p_lodge_id and characters.id = character_lodges.character_id and characters.profile_id = v_actor;
  delete from public.lodge_members where id = v_membership.id;
end;
$$;

create or replace function public.remove_lodge_member(p_membership_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_target public.lodge_members;
begin
  select * into v_target from public.lodge_members where id = p_membership_id for update;
  if v_actor is null or not found or v_target.role = 'owner' or not exists (
    select 1 from public.lodge_members where lodge_id = v_target.lodge_id and profile_id = v_actor and role = 'owner'
  ) then raise exception 'remove_lodge_member: Lodge owner required' using errcode = '42501'; end if;
  delete from public.character_lodges using public.characters
  where character_lodges.lodge_id = v_target.lodge_id and characters.id = character_lodges.character_id and characters.profile_id = v_target.profile_id;
  delete from public.lodge_members where id = v_target.id;
  insert into public.audit_events (lodge_id, actor_id, action, target_table, target_id)
  values (v_target.lodge_id, v_actor, 'lodge.member_removed', 'lodge_members', v_target.id);
end;
$$;

create or replace function public.delete_lodge(p_lodge_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_lodge public.lodges;
begin
  select * into v_lodge from public.lodges where id = p_lodge_id for update;
  if v_actor is null or not found or not exists (
    select 1 from public.lodge_members where lodge_id = p_lodge_id and profile_id = v_actor and role = 'owner'
  ) then raise exception 'delete_lodge: Lodge owner required' using errcode = '42501'; end if;
  if p_confirmation is distinct from 'DELETE ' || v_lodge.name then
    raise exception 'delete_lodge: confirmation does not match' using errcode = '22023';
  end if;
  delete from public.lodges where id = v_lodge.id;
end;
$$;

revoke all on function public.request_lodge_ownership_transfer(uuid) from public, anon;
revoke all on function public.accept_lodge_ownership_transfer(uuid) from public, anon;
revoke all on function public.cancel_lodge_ownership_transfer(uuid) from public, anon;
revoke all on function public.leave_lodge(uuid) from public, anon;
revoke all on function public.remove_lodge_member(uuid) from public, anon;
revoke all on function public.delete_lodge(uuid, text) from public, anon;
grant execute on function public.request_lodge_ownership_transfer(uuid) to authenticated;
grant execute on function public.accept_lodge_ownership_transfer(uuid) to authenticated;
grant execute on function public.cancel_lodge_ownership_transfer(uuid) to authenticated;
grant execute on function public.leave_lodge(uuid) to authenticated;
grant execute on function public.remove_lodge_member(uuid) to authenticated;
grant execute on function public.delete_lodge(uuid, text) to authenticated;
