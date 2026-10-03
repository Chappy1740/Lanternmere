-- A Guild departure must not erase loot decisions or block consent cleanup.
-- Retain the candidate and its votes with a bounded name snapshot after the
-- membership row disappears. Guild or raid deletion can still remove its data.
alter table public.guild_raid_loot_candidates add column member_label text;
update public.guild_raid_loot_candidates candidate
set member_label = coalesce(nullif(btrim(profile.display_name), ''), 'Guild member')
from public.guild_members member
join public.profiles profile on profile.id = member.profile_id
where candidate.guild_member_id = member.id;
update public.guild_raid_loot_candidates
set member_label = 'Former Guild member' where member_label is null;
alter table public.guild_raid_loot_candidates
  alter column member_label set not null,
  add constraint guild_raid_loot_candidates_member_label_bound
    check (length(btrim(member_label)) between 1 and 80),
  alter column guild_member_id drop not null;
alter table public.guild_raid_loot_candidates
  drop constraint guild_raid_loot_candidates_guild_member_id_fkey;
alter table public.guild_raid_loot_candidates
  add constraint guild_raid_loot_candidates_guild_member_id_fkey
    foreign key (guild_member_id) references public.guild_members(id) on delete set null;
create index idx_guild_raid_loot_candidates_member
  on public.guild_raid_loot_candidates(guild_member_id)
  where guild_member_id is not null;

-- A deleted Guild or raid may cascade through its drops and candidates without
-- a RESTRICT edge interrupting the operation. Ordinary clients cannot delete
-- candidate rows directly.
alter table public.guild_raid_loot_awards
  drop constraint guild_raid_loot_awards_candidate_id_fkey;
alter table public.guild_raid_loot_awards
  add constraint guild_raid_loot_awards_candidate_id_fkey
    foreign key (candidate_id) references public.guild_raid_loot_candidates(id) on delete cascade;

create or replace function public.set_guild_raid_loot_candidate(
  p_loot_drop_id uuid, p_guild_member_id uuid, p_interest text,
  p_factual_context text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_guild_id uuid;
  v_label text;
  v_previous text;
begin
  select operation.guild_id into v_guild_id
  from public.guild_raid_loot_drops drop_row
  join public.guild_raid_operations operation on operation.id = drop_row.operation_id
  where drop_row.id = p_loot_drop_id for update of drop_row;
  if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then
    raise exception 'Loot Council or Guild leadership required' using errcode = '42501';
  end if;
  if exists (select 1 from public.guild_raid_loot_awards where loot_drop_id = p_loot_drop_id) then
    raise exception 'Awarded loot decisions are closed' using errcode = '42501';
  end if;
  if p_interest not in ('need', 'offspec', 'pass') or p_factual_context is null
    or length(p_factual_context) > 1000 then
    raise exception 'Invalid loot candidate' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(profile.display_name), ''), 'Guild member') into v_label
  from public.guild_members member
  join public.profiles profile on profile.id = member.profile_id
  where member.id = p_guild_member_id and member.guild_id = v_guild_id;
  if v_label is null then
    raise exception 'Invalid loot candidate' using errcode = '22023';
  end if;
  select factual_context into v_previous from public.guild_raid_loot_candidates
  where loot_drop_id = p_loot_drop_id and guild_member_id = p_guild_member_id;
  insert into public.guild_raid_loot_candidates (
    loot_drop_id, guild_member_id, member_label, interest, factual_context, recorded_by
  ) values (
    p_loot_drop_id, p_guild_member_id, v_label, p_interest, p_factual_context, v_actor
  ) on conflict (loot_drop_id, guild_member_id) do update set
    member_label = excluded.member_label,
    interest = excluded.interest,
    factual_context = excluded.factual_context,
    recorded_by = excluded.recorded_by;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.loot_candidate_recorded', 'guild_raid_loot_candidates',
    p_loot_drop_id, jsonb_build_object(
      'guild_member_id', p_guild_member_id,
      'interest', p_interest,
      'factual_context_sha256', encode(extensions.digest(p_factual_context, 'sha256'), 'hex'),
      'previous_context_sha256', case when v_previous is null then null
        else encode(extensions.digest(v_previous, 'sha256'), 'hex') end
    ));
end;
$$;

create or replace function public.cast_guild_raid_loot_vote(
  p_loot_drop_id uuid, p_candidate_id uuid, p_rationale text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_guild_id uuid;
  v_previous text;
begin
  select operation.guild_id into v_guild_id
  from public.guild_raid_loot_drops drop_row
  join public.guild_raid_operations operation on operation.id = drop_row.operation_id
  where drop_row.id = p_loot_drop_id for update of drop_row;
  if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then
    raise exception 'Loot Council or Guild leadership required' using errcode = '42501';
  end if;
  if exists (select 1 from public.guild_raid_loot_awards where loot_drop_id = p_loot_drop_id) then
    raise exception 'Awarded loot decisions are closed' using errcode = '42501';
  end if;
  if p_rationale is null or length(p_rationale) > 1000 or not exists (
    select 1 from public.guild_raid_loot_candidates
    where id = p_candidate_id and loot_drop_id = p_loot_drop_id
  ) then
    raise exception 'Invalid loot vote' using errcode = '22023';
  end if;
  select rationale into v_previous from public.guild_raid_loot_votes
  where loot_drop_id = p_loot_drop_id and voter_id = v_actor;
  insert into public.guild_raid_loot_votes (loot_drop_id, candidate_id, voter_id, rationale)
  values (p_loot_drop_id, p_candidate_id, v_actor, p_rationale)
  on conflict (loot_drop_id, voter_id) do update set
    candidate_id = excluded.candidate_id,
    rationale = excluded.rationale,
    created_at = now();
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.loot_vote_cast', 'guild_raid_loot_votes',
    p_loot_drop_id, jsonb_build_object(
      'candidate_id', p_candidate_id,
      'rationale_sha256', encode(extensions.digest(p_rationale, 'sha256'), 'hex'),
      'previous_rationale_sha256', case when v_previous is null then null
        else encode(extensions.digest(v_previous, 'sha256'), 'hex') end
    ));
end;
$$;

create or replace function public.award_guild_raid_loot(
  p_loot_drop_id uuid, p_candidate_id uuid, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
  select operation.guild_id into v_guild_id
  from public.guild_raid_loot_drops drop_row
  join public.guild_raid_operations operation on operation.id = drop_row.operation_id
  where drop_row.id = p_loot_drop_id for update of drop_row;
  if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then
    raise exception 'Loot Council or Guild leadership required' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 or length(p_reason) > 1000
    or not exists (select 1 from public.guild_raid_loot_candidates
      where id = p_candidate_id and loot_drop_id = p_loot_drop_id) then
    raise exception 'Invalid loot award' using errcode = '22023';
  end if;
  insert into public.guild_raid_loot_awards (loot_drop_id, candidate_id, reason, awarded_by)
  values (p_loot_drop_id, p_candidate_id, btrim(p_reason), v_actor)
  returning id into v_id;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor, 'guild.loot_awarded', 'guild_raid_loot_awards', v_id,
    jsonb_build_object('loot_drop_id', p_loot_drop_id, 'candidate_id', p_candidate_id));
  return v_id;
end;
$$;

-- Clearing an optional character context revokes the selected Traveler without
-- changing that Traveler's underlying Guild consent.
create or replace function public.set_guild_raid_operation_member_character(
  p_operation_id uuid, p_guild_member_id uuid, p_character_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_profile_id uuid;
begin
  select guild_id into v_guild_id from public.guild_raid_operations where id = p_operation_id;
  if v_actor is null or v_guild_id is null or not private.can_lead_guild(v_guild_id) then
    raise exception 'Guild leadership required' using errcode = '42501';
  end if;
  select profile_id into v_profile_id from public.guild_members
  where id = p_guild_member_id and guild_id = v_guild_id;
  if v_profile_id is null or p_character_id is not null and not exists (
    select 1 from public.character_guild_sharing sharing
    join public.characters character on character.id = sharing.character_id
    where sharing.character_id = p_character_id and sharing.guild_id = v_guild_id
      and character.profile_id = v_profile_id
  ) then
    raise exception 'Character context is not consented for this Guild member' using errcode = '42501';
  end if;
  update public.guild_raid_operation_members set character_id = p_character_id
  where operation_id = p_operation_id and guild_member_id = p_guild_member_id;
  if not found then
    raise exception 'Guild member is not planned for this operation' using errcode = '42501';
  end if;
  insert into public.guild_audit_events (guild_id, actor_id, action, target_table, target_id, metadata)
  values (v_guild_id, v_actor,
    case when p_character_id is null then 'guild.raid_member_character_cleared'
      else 'guild.raid_member_character_selected' end,
    'guild_raid_operation_members', p_operation_id,
    jsonb_build_object('guild_member_id', p_guild_member_id, 'character_id', p_character_id));
end;
$$;
