-- Vault notes remain private unless their owner opts into one Guild's leadership view.
create table public.guild_vault_sharing (
  id uuid primary key default gen_random_uuid(),
  vault_progress_id uuid not null references public.weekly_vault_progress(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (vault_progress_id, guild_id)
);

create index idx_guild_vault_sharing_guild on public.guild_vault_sharing(guild_id, vault_progress_id);
create index idx_guild_vault_sharing_owner on public.guild_vault_sharing(profile_id, vault_progress_id);

alter table public.guild_vault_sharing enable row level security;
revoke all on public.guild_vault_sharing from public, anon, authenticated;
grant select on public.guild_vault_sharing to authenticated;
create policy "guild_vault_sharing_select_owner_or_leadership"
  on public.guild_vault_sharing for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.can_lead_guild(guild_id) and exists (
      select 1 from public.guild_members gm
      where gm.guild_id = guild_vault_sharing.guild_id and gm.profile_id = guild_vault_sharing.profile_id
    )
  );

create policy "weekly_vault_progress_select_consented_leadership"
  on public.weekly_vault_progress for select to authenticated
  using (exists (
    select 1 from public.guild_vault_sharing s
    where s.vault_progress_id = weekly_vault_progress.id and private.can_lead_guild(s.guild_id)
      and exists (
        select 1 from public.guild_members gm
        where gm.guild_id = s.guild_id and gm.profile_id = s.profile_id
      )
  ));

create function public.set_guild_vault_sharing(p_vault_progress_id uuid, p_guild_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null
    or p_enabled is true and not private.is_guild_member(p_guild_id)
    or not exists (select 1 from public.weekly_vault_progress v where v.id = p_vault_progress_id and v.profile_id = v_actor) then
    raise exception 'Vault owner and Guild membership required' using errcode = '42501';
  end if;
  if p_enabled is true then
    insert into public.guild_vault_sharing (vault_progress_id, guild_id, profile_id)
    values (p_vault_progress_id, p_guild_id, v_actor)
    on conflict (vault_progress_id, guild_id) do nothing;
  elsif p_enabled is false then
    delete from public.guild_vault_sharing
    where vault_progress_id = p_vault_progress_id and guild_id = p_guild_id and profile_id = v_actor;
  else
    raise exception 'Sharing choice required' using errcode = '22023';
  end if;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (
    p_guild_id, v_actor,
    case when p_enabled then 'guild.vault_context_shared' else 'guild.vault_context_unshared' end,
    'weekly_vault_progress', p_vault_progress_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.set_guild_vault_sharing(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_guild_vault_sharing(uuid, uuid, boolean) to authenticated;
