-- Keep accepted transfer history when a former owner or recipient leaves.
-- A pending transfer whose recipient leaves becomes ineligible; a new request
-- cancels the stale row before it creates the replacement.
alter table public.lodge_ownership_transfers
  alter column from_membership_id drop not null,
  alter column to_membership_id drop not null,
  drop constraint lodge_ownership_transfers_from_membership_id_fkey,
  drop constraint lodge_ownership_transfers_to_membership_id_fkey,
  add constraint lodge_ownership_transfers_from_membership_id_fkey
    foreign key (from_membership_id) references public.lodge_members(id) on delete set null,
  add constraint lodge_ownership_transfers_to_membership_id_fkey
    foreign key (to_membership_id) references public.lodge_members(id) on delete set null;

-- Select the owner in the recipient's Lodge; an account may own several.
create or replace function public.request_lodge_ownership_transfer(p_to_membership_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_from public.lodge_members;
  v_to public.lodge_members;
  v_transfer_id uuid;
begin
  if v_actor is null then
    raise exception 'request_lodge_ownership_transfer: Lodge owner required' using errcode = '42501';
  end if;
  select * into v_to from public.lodge_members
  where id = p_to_membership_id and role <> 'owner' for update;
  if not found then
    raise exception 'request_lodge_ownership_transfer: recipient must be another Lodge member' using errcode = '22023';
  end if;
  select * into v_from from public.lodge_members
  where profile_id = v_actor and lodge_id = v_to.lodge_id and role = 'owner' for update;
  if not found then
    raise exception 'request_lodge_ownership_transfer: Lodge owner required' using errcode = '42501';
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

-- A missing membership must never make an old transfer look actionable.
drop index public.lodge_ownership_transfers_one_pending_per_lodge;
create unique index lodge_ownership_transfers_one_pending_per_lodge
  on public.lodge_ownership_transfers(lodge_id)
  where accepted_at is null and canceled_at is null
    and from_membership_id is not null and to_membership_id is not null;
