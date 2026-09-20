-- Lodge invitations are bearer links. Only a SHA-256 hash is persisted; the
-- raw token is shown once to the creating owner and is never stored in a row.
create table public.lodge_invitations (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  email text,
  role text not null default 'member' check (role in ('member', 'guest')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_at is null) = (accepted_by is null))
);

create index idx_lodge_invitations_lodge_created
  on public.lodge_invitations(lodge_id, created_at desc);

alter table public.lodge_invitations enable row level security;

create policy "lodge_invitations_select_owner" on public.lodge_invitations
  for select
  to authenticated
  using (private.is_lodge_owner(lodge_id));

create policy "lodge_invitations_insert_owner" on public.lodge_invitations
  for insert
  to authenticated
  with check (
    private.is_lodge_owner(lodge_id)
    and created_by = (select auth.uid())
    and role in ('member', 'guest')
  );

create policy "lodge_invitations_revoke_owner" on public.lodge_invitations
  for update
  to authenticated
  using (private.is_lodge_owner(lodge_id))
  with check (private.is_lodge_owner(lodge_id));

create or replace function private.guard_lodge_invitation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lodge_id is distinct from old.lodge_id
    or new.created_by is distinct from old.created_by
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.token_hash is distinct from old.token_hash
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at then
    raise exception 'lodge invitation identity cannot be changed'
      using errcode = '42501';
  end if;

  if new.accepted_at is distinct from old.accepted_at
    or new.accepted_by is distinct from old.accepted_by then
    if old.accepted_at is not null
      or old.revoked_at is not null
      or new.accepted_at is null
      or new.accepted_by is distinct from (select auth.uid()) then
      raise exception 'lodge invitation cannot be accepted'
        using errcode = '42501';
    end if;
  end if;

  if new.revoked_at is distinct from old.revoked_at
    and not private.is_lodge_owner(old.lodge_id) then
    raise exception 'only a Lodge owner can revoke an invitation'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_lodge_invitations_guard_update
  before update on public.lodge_invitations
  for each row execute function private.guard_lodge_invitation_update();

-- Redeem the bearer token and insert the membership in one transaction. Email
-- addressed invitations may only be redeemed by the matching authenticated
-- account; share links leave email null and are not account-bound.
create or replace function public.redeem_lodge_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_invitation public.lodge_invitations;
begin
  if v_actor is null then
    raise exception 'redeem_lodge_invitation: authentication required'
      using errcode = '42501';
  end if;

  if p_token is null or length(p_token) < 32 then
    raise exception 'redeem_lodge_invitation: invalid invitation'
      using errcode = '22023';
  end if;

  select * into v_invitation
  from public.lodge_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'redeem_lodge_invitation: invitation is unavailable'
      using errcode = '22023';
  end if;

  if v_invitation.email is not null then
    select lower(email) into v_email
    from auth.users
    where id = v_actor;
    if v_email is distinct from lower(v_invitation.email) then
      raise exception 'redeem_lodge_invitation: invitation email does not match this account'
        using errcode = '42501';
    end if;
  end if;

  insert into public.lodge_members (lodge_id, profile_id, role)
  values (v_invitation.lodge_id, v_actor, v_invitation.role)
  on conflict (lodge_id, profile_id) do nothing;

  update public.lodge_invitations
  set accepted_at = now(), accepted_by = v_actor
  where id = v_invitation.id;

  insert into public.audit_events (lodge_id, actor_id, action, target_table, target_id)
  values (
    v_invitation.lodge_id,
    v_actor,
    'lodge.invitation_redeemed',
    'lodge_invitations',
    v_invitation.id
  );

  return v_invitation.lodge_id;
end;
$$;

revoke all on function public.redeem_lodge_invitation(text) from public, anon;
grant execute on function public.redeem_lodge_invitation(text) to authenticated;

-- Membership roles are owner-managed. Owners remain immutable in the MVP;
-- ownership transfer is deliberately a future, separately reviewed workflow.
drop policy "lodge_members_insert_admin" on public.lodge_members;
drop policy "lodge_members_update_admin" on public.lodge_members;
drop policy "lodge_members_delete_admin_or_self" on public.lodge_members;

create policy "lodge_members_insert_owner" on public.lodge_members
  for insert
  to authenticated
  with check (
    private.is_lodge_owner(lodge_id)
    and role in ('caretaker', 'member', 'guest')
  );

create policy "lodge_members_update_owner" on public.lodge_members
  for update
  to authenticated
  using (private.is_lodge_owner(lodge_id) and role <> 'owner')
  with check (
    private.is_lodge_owner(lodge_id)
    and role in ('caretaker', 'member', 'guest')
  );

create policy "lodge_members_delete_owner_or_nonowner_self" on public.lodge_members
  for delete
  to authenticated
  using (
    (private.is_lodge_owner(lodge_id) and role <> 'owner')
    or (profile_id = (select auth.uid()) and role <> 'owner')
  );
