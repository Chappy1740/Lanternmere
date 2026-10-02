-- Only the Traveler owner or a current Lodge leader may read consented readiness.
drop policy "raiderio_snapshots_select_selected_lodge" on public.character_raiderio_snapshots;
create policy "raiderio_snapshots_select_selected_lodge" on public.character_raiderio_snapshots
  for select to authenticated using (
    private.owns_character(character_id)
    or exists (
      select 1 from public.character_raiderio_sharing sharing
      where sharing.character_id = character_raiderio_snapshots.character_id
        and private.is_lodge_admin(sharing.lodge_id)
    )
  );

-- Even a leader receives only the readiness fields through the Data API.
-- The owner-only progression display is loaded by trusted server code after ownership verification.
revoke select on public.character_raiderio_snapshots from public, anon, authenticated;
grant select (character_id, character_name, realm_slug, region,
  mythic_plus_score, source_url, refreshed_at, failure_message)
  on public.character_raiderio_snapshots to authenticated;
grant select on public.character_raiderio_snapshots to service_role;

drop policy "raidbots_reports_select_lodge_member_or_owner" on public.character_raidbots_reports;
create policy "raidbots_reports_select_lodge_member_or_owner" on public.character_raidbots_reports
  for select to authenticated using (
    private.owns_character(character_id) or private.is_lodge_admin(lodge_id)
  );

-- One atomic claim per Traveler each 24 hours, including failed upstream requests.
create table public.character_raiderio_refresh_attempts (
  character_id uuid primary key references public.characters(id) on delete cascade,
  character_name text not null,
  realm_slug text not null,
  region text not null,
  attempted_at timestamptz not null,
  failure_message text check (failure_message is null or length(failure_message) <= 240)
);
alter table public.character_raiderio_refresh_attempts enable row level security;
revoke all on public.character_raiderio_refresh_attempts from public, anon, authenticated;
grant select on public.character_raiderio_refresh_attempts to authenticated;
grant select, insert, update on public.character_raiderio_refresh_attempts to service_role;
create policy "raiderio_attempts_select_owner_or_leader" on public.character_raiderio_refresh_attempts
  for select to authenticated using (
    private.owns_character(character_id)
    or exists (
      select 1 from public.character_raiderio_sharing sharing
      where sharing.character_id = character_raiderio_refresh_attempts.character_id
        and private.is_lodge_admin(sharing.lodge_id)
    )
  );

-- Preserve the cooldown for snapshots saved before this claim table existed.
insert into public.character_raiderio_refresh_attempts
  (character_id, character_name, realm_slug, region, attempted_at, failure_message)
select snapshot.character_id, snapshot.character_name, snapshot.realm_slug, snapshot.region,
  case when snapshot.failure_message is null then snapshot.refreshed_at
       else greatest(snapshot.refreshed_at, snapshot.updated_at) end,
  snapshot.failure_message
from public.character_raiderio_snapshots snapshot;

create function public.claim_raiderio_refresh(p_character_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_claimed boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'Trusted server access required.' using errcode = '42501';
  end if;
  if p_character_id is null then
    raise exception 'A Traveler is required.' using errcode = '22023';
  end if;
  insert into public.character_raiderio_refresh_attempts
    (character_id, character_name, realm_slug, region, attempted_at, failure_message)
  select character.id, character.character_name, character.realm_slug, character.region, now(), null
  from public.characters character where character.id = p_character_id
  on conflict (character_id) do update
    set character_name = excluded.character_name,
        realm_slug = excluded.realm_slug,
        region = excluded.region,
        attempted_at = excluded.attempted_at,
        failure_message = null
    where character_raiderio_refresh_attempts.attempted_at <= excluded.attempted_at - interval '24 hours'
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;
revoke all on function public.claim_raiderio_refresh(uuid) from public, anon, authenticated;
grant execute on function public.claim_raiderio_refresh(uuid) to service_role;

alter table public.character_raidbots_reports
  add constraint raidbots_upgrade_targets_length_check
    check (upgrade_targets is null or length(upgrade_targets) <= 500) not valid;
alter table public.character_raidbots_reports
  validate constraint raidbots_upgrade_targets_length_check;
