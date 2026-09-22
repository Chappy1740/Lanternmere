-- Guilds are independent from Lodges. Joining a Guild never grants Lodge,
-- Traveler, character, RSVP, or external-snapshot access.
create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  member_portal_enabled boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_guilds_updated_at
  before update on public.guilds
  for each row execute function private.set_updated_at();

create table public.guild_members (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (guild_id, profile_id)
);

create index idx_guild_members_profile on public.guild_members(profile_id, joined_at);

-- Roles are composable: a raid leader may also be on the loot council.
-- Guild membership alone intentionally conveys no leadership capability.
create table public.guild_member_roles (
  guild_member_id uuid not null references public.guild_members(id) on delete cascade,
  role text not null check (role in ('guild_master', 'officer', 'raid_leader', 'loot_council')),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (guild_member_id, role)
);

create index idx_guild_member_roles_member on public.guild_member_roles(guild_member_id);

-- Bearer tokens are stored only as SHA-256 hashes. Invitations create ordinary
-- members; leadership grants are an explicit, separately audited operation.
create table public.guild_invitations (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  email text,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_at is null) = (accepted_by is null))
);

create index idx_guild_invitations_guild_created
  on public.guild_invitations(guild_id, created_at desc);

-- Guild audit history is intentionally separate from Lodge audit history.
create table public.guild_audit_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_guild_audit_events_guild_created
  on public.guild_audit_events(guild_id, created_at desc);

-- Explicit owner consent for a character in a specific Guild. This is not a
-- Lodge-sharing alias and creates no access until a future Guild roster reads it.
create table public.character_guild_sharing (
  character_id uuid not null references public.characters(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  visibility text not null check (visibility in ('leadership', 'members')),
  enabled_at timestamptz not null default now(),
  primary key (character_id, guild_id)
);

create index idx_character_guild_sharing_guild on public.character_guild_sharing(guild_id);

create or replace function private.is_guild_member(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guild_members member
    where member.guild_id = p_guild_id
      and member.profile_id = (select auth.uid())
  );
$$;

create or replace function private.has_guild_role(p_guild_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guild_members member
    join public.guild_member_roles member_role on member_role.guild_member_id = member.id
    where member.guild_id = p_guild_id
      and member.profile_id = (select auth.uid())
      and member_role.role = p_role
  );
$$;

create or replace function private.can_manage_guild(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_guild_role(p_guild_id, 'guild_master')
      or private.has_guild_role(p_guild_id, 'officer');
$$;

create or replace function private.can_lead_guild(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_guild(p_guild_id)
      or private.has_guild_role(p_guild_id, 'raid_leader');
$$;

create or replace function private.shares_guild_with(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guild_members mine
    join public.guild_members theirs on theirs.guild_id = mine.guild_id
    where mine.profile_id = (select auth.uid()) and theirs.profile_id = p_profile_id
  );
$$;

create or replace function private.prevent_guild_identity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Guild creator cannot be changed.' using errcode = '42501';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'Guild slug cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_guilds_prevent_identity_changes
  before update on public.guilds
  for each row execute function private.prevent_guild_identity_changes();

create or replace function private.guard_guild_invitation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.guild_id is distinct from old.guild_id
    or new.created_by is distinct from old.created_by
    or new.email is distinct from old.email
    or new.token_hash is distinct from old.token_hash
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Guild invitation identity cannot be changed.' using errcode = '42501';
  end if;
  if new.revoked_at is distinct from old.revoked_at
    and not private.can_manage_guild(old.guild_id) then
    raise exception 'Only Guild leadership can revoke an invitation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_guild_invitations_guard_update
  before update on public.guild_invitations
  for each row execute function private.guard_guild_invitation_update();

create or replace function public.create_guild(
  p_name text,
  p_description text default null
)
returns public.guilds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_base text;
  v_slug text;
  v_guild public.guilds;
  v_member public.guild_members;
  v_attempt int := 0;
begin
  if v_actor is null then
    raise exception 'create_guild: authentication required' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 60 then
    raise exception 'create_guild: Guild name must be between 1 and 60 characters' using errcode = '22023';
  end if;

  v_base := private.slugify(btrim(p_name));
  if v_base = '' then v_base := 'guild'; end if;
  v_slug := v_base;
  loop
    begin
      insert into public.guilds (name, slug, description, created_by)
      values (btrim(p_name), v_slug, nullif(btrim(coalesce(p_description, '')), ''), v_actor)
      returning * into v_guild;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise exception 'create_guild: could not generate a unique slug' using errcode = '23505';
      end if;
      v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    end;
  end loop;

  insert into public.guild_members (guild_id, profile_id)
  values (v_guild.id, v_actor)
  returning * into v_member;
  insert into public.guild_member_roles (guild_member_id, role, granted_by)
  values (v_member.id, 'guild_master', v_actor);
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (v_guild.id, v_actor, 'guild.created', 'guilds', v_guild.id);
  return v_guild;
end;
$$;

create or replace function public.redeem_guild_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_invitation public.guild_invitations;
begin
  if v_actor is null then
    raise exception 'redeem_guild_invitation: authentication required' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 32 then
    raise exception 'redeem_guild_invitation: invalid invitation' using errcode = '22023';
  end if;
  select * into v_invitation
  from public.guild_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'redeem_guild_invitation: invitation is unavailable' using errcode = '22023';
  end if;
  if v_invitation.email is not null then
    select lower(email) into v_email from auth.users where id = v_actor;
    if v_email is distinct from lower(v_invitation.email) then
      raise exception 'redeem_guild_invitation: invitation email does not match this account' using errcode = '42501';
    end if;
  end if;
  insert into public.guild_members (guild_id, profile_id)
  values (v_invitation.guild_id, v_actor)
  on conflict (guild_id, profile_id) do nothing;
  update public.guild_invitations set accepted_at = now(), accepted_by = v_actor
  where id = v_invitation.id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id)
  values (v_invitation.guild_id, v_actor, 'guild.invitation_redeemed', 'guild_invitations', v_invitation.id);
  return v_invitation.guild_id;
end;
$$;

create or replace function public.set_guild_member_portal(
  p_guild_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.can_manage_guild(p_guild_id) then
    raise exception 'set_guild_member_portal: Guild leadership required' using errcode = '42501';
  end if;
  update public.guilds
  set member_portal_enabled = p_enabled
  where id = p_guild_id
    and member_portal_enabled is distinct from p_enabled;
  if found then
    insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
    values (
      p_guild_id,
      v_actor,
      'guild.member_portal_changed',
      'guilds',
      p_guild_id,
      jsonb_build_object('enabled', p_enabled)
    );
  end if;
end;
$$;

create or replace function public.create_guild_invitation(p_guild_id uuid, p_email text, p_token_hash text, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null or not private.can_manage_guild(p_guild_id) then raise exception 'Guild leadership required' using errcode = '42501'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '30 days' then raise exception 'Invalid Guild invitation' using errcode = '22023'; end if;
  insert into public.guild_invitations (guild_id, created_by, email, token_hash, expires_at)
  values (p_guild_id, v_actor, nullif(lower(btrim(p_email)), ''), p_token_hash, p_expires_at) returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id) values (p_guild_id, v_actor, 'guild.invitation_created', 'guild_invitations', v_id);
  return v_id;
end;
$$;

create or replace function public.set_guild_member_role(p_guild_member_id uuid, p_role text, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
  select guild_id into v_guild_id from public.guild_members where id = p_guild_member_id;
  if v_actor is null or v_guild_id is null or p_role not in ('officer', 'raid_leader', 'loot_council') then raise exception 'Invalid Guild role change' using errcode = '22023'; end if;
  if not private.has_guild_role(v_guild_id, 'guild_master') and not (private.has_guild_role(v_guild_id, 'officer') and p_role in ('raid_leader', 'loot_council')) then raise exception 'Guild role change not permitted' using errcode = '42501'; end if;
  if p_enabled then insert into public.guild_member_roles (guild_member_id, role, granted_by) values (p_guild_member_id, p_role, v_actor) on conflict do nothing;
  else delete from public.guild_member_roles where guild_member_id = p_guild_member_id and role = p_role; end if;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata) values (v_guild_id, v_actor, 'guild.member_role_changed', 'guild_members', p_guild_member_id, jsonb_build_object('role', p_role, 'enabled', p_enabled));
end;
$$;

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_member_roles enable row level security;
alter table public.guild_invitations enable row level security;
alter table public.guild_audit_events enable row level security;
alter table public.character_guild_sharing enable row level security;

revoke all on public.guilds, public.guild_members, public.guild_member_roles, public.guild_invitations, public.guild_audit_events from anon;
grant select, update on public.guilds to authenticated;
grant select, delete on public.guild_members to authenticated;
grant select, insert, delete on public.guild_member_roles to authenticated;
grant select, insert, update on public.guild_invitations to authenticated;
grant select on public.guild_audit_events to authenticated;
grant select, insert, delete on public.character_guild_sharing to authenticated;
revoke all on function public.create_guild(text, text) from public, anon;
grant execute on function public.create_guild(text, text) to authenticated;
revoke all on function public.redeem_guild_invitation(text) from public, anon;
grant execute on function public.redeem_guild_invitation(text) to authenticated;
revoke all on function public.set_guild_member_portal(uuid, boolean) from public, anon;
grant execute on function public.set_guild_member_portal(uuid, boolean) to authenticated;
revoke all on function public.create_guild_invitation(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.create_guild_invitation(uuid, text, text, timestamptz) to authenticated;
revoke all on function public.set_guild_member_role(uuid, text, boolean) from public, anon;
grant execute on function public.set_guild_member_role(uuid, text, boolean) to authenticated;

create policy "guilds_select_member" on public.guilds for select to authenticated
  using (private.is_guild_member(id));
create policy "guilds_update_management" on public.guilds for update to authenticated
  using (private.can_manage_guild(id)) with check (private.can_manage_guild(id));
create policy "guild_members_select_member" on public.guild_members for select to authenticated
  using (private.is_guild_member(guild_id));
create policy "guild_members_leave_nonmaster" on public.guild_members for delete to authenticated
  using (profile_id = (select auth.uid()) and not private.has_guild_role(guild_id, 'guild_master'));
create policy "guild_member_roles_select_member" on public.guild_member_roles for select to authenticated
  using (exists (select 1 from public.guild_members member where member.id = guild_member_id and private.is_guild_member(member.guild_id)));
create policy "guild_member_roles_grant_master_or_limited_officer" on public.guild_member_roles for insert to authenticated
  with check (exists (
    select 1 from public.guild_members member
    where member.id = guild_member_id
      and ((private.has_guild_role(member.guild_id, 'guild_master'))
        or (private.has_guild_role(member.guild_id, 'officer') and role in ('raid_leader', 'loot_council')))
  ));
create policy "guild_member_roles_revoke_master_or_limited_officer" on public.guild_member_roles for delete to authenticated
  using (exists (
    select 1 from public.guild_members member
    where member.id = guild_member_id
      and role <> 'guild_master'
      and ((private.has_guild_role(member.guild_id, 'guild_master'))
        or (private.has_guild_role(member.guild_id, 'officer') and role in ('raid_leader', 'loot_council')))
  ));
create policy "guild_invitations_select_management" on public.guild_invitations for select to authenticated
  using (private.can_manage_guild(guild_id));
create policy "guild_invitations_insert_management" on public.guild_invitations for insert to authenticated
  with check (private.can_manage_guild(guild_id) and created_by = (select auth.uid()));
create policy "guild_invitations_revoke_management" on public.guild_invitations for update to authenticated
  using (private.can_manage_guild(guild_id)) with check (private.can_manage_guild(guild_id));
create policy "guild_audit_events_select_management" on public.guild_audit_events for select to authenticated
  using (private.can_manage_guild(guild_id));
create policy "character_guild_sharing_select_owner_or_scope" on public.character_guild_sharing for select to authenticated using (
  private.owns_character(character_id) or (visibility = 'members' and private.is_guild_member(guild_id)) or (visibility = 'leadership' and private.can_lead_guild(guild_id))
);
create policy "character_guild_sharing_insert_owner" on public.character_guild_sharing for insert to authenticated with check (private.owns_character(character_id) and private.is_guild_member(guild_id));
create policy "character_guild_sharing_delete_owner" on public.character_guild_sharing for delete to authenticated using (private.owns_character(character_id));

drop policy if exists "profiles_select_self_or_lodgemate" on public.profiles;
create policy "profiles_select_self_lodgemate_or_guildmate" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or private.shares_lodge_with(id) or private.shares_guild_with(id)
);
