-- Loot decisions are recorded, never automatically derived or awarded.
create table public.guild_raid_loot_drops (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.guild_raid_operations(id) on delete cascade,
  item_name text not null check (length(btrim(item_name)) between 1 and 160),
  item_level integer check (item_level between 1 and 1000),
  equipment_slot text not null default '' check (length(equipment_slot) <= 80),
  source_note text not null default '' check (length(source_note) <= 1000),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_guild_raid_loot_drops_operation on public.guild_raid_loot_drops(operation_id, created_at);

create table public.guild_raid_loot_candidates (
  id uuid primary key default gen_random_uuid(),
  loot_drop_id uuid not null references public.guild_raid_loot_drops(id) on delete cascade,
  guild_member_id uuid not null references public.guild_members(id) on delete cascade,
  interest text not null check (interest in ('need', 'offspec', 'pass')),
  factual_context text not null default '' check (length(factual_context) <= 1000),
  recorded_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (loot_drop_id, guild_member_id)
);
create index idx_guild_raid_loot_candidates_drop on public.guild_raid_loot_candidates(loot_drop_id, interest);
create trigger trg_guild_raid_loot_candidates_updated_at before update on public.guild_raid_loot_candidates for each row execute function private.set_updated_at();

create table public.guild_raid_loot_votes (
  id uuid primary key default gen_random_uuid(),
  loot_drop_id uuid not null references public.guild_raid_loot_drops(id) on delete cascade,
  candidate_id uuid not null references public.guild_raid_loot_candidates(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  rationale text not null default '' check (length(rationale) <= 1000),
  created_at timestamptz not null default now(),
  unique (loot_drop_id, voter_id)
);
create index idx_guild_raid_loot_votes_drop on public.guild_raid_loot_votes(loot_drop_id, candidate_id);

create table public.guild_raid_loot_awards (
  id uuid primary key default gen_random_uuid(),
  loot_drop_id uuid not null unique references public.guild_raid_loot_drops(id) on delete cascade,
  candidate_id uuid not null references public.guild_raid_loot_candidates(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  awarded_by uuid not null references public.profiles(id),
  awarded_at timestamptz not null default now()
);

create or replace function private.can_manage_guild_loot(p_guild_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_lead_guild(p_guild_id) or private.has_guild_role(p_guild_id, 'loot_council');
$$;
create or replace function private.can_manage_guild_loot_drop(p_loot_drop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guild_raid_loot_drops drop_row join public.guild_raid_operations operation on operation.id = drop_row.operation_id where drop_row.id = p_loot_drop_id and private.can_manage_guild_loot(operation.guild_id));
$$;

-- All mutations share the same Guild- and operation-ownership checks and append audit history.
create or replace function public.create_guild_raid_loot_drop(p_operation_id uuid, p_item_name text, p_item_level integer default null, p_equipment_slot text default '', p_source_note text default '') returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
 select guild_id into v_guild_id from public.guild_raid_operations where id=p_operation_id;
 if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then raise exception 'Loot Council or Guild leadership required' using errcode='42501'; end if;
 if p_item_name is null or length(btrim(p_item_name))=0 or length(p_item_name)>160 or p_item_level is not null and (p_item_level<1 or p_item_level>1000) or p_equipment_slot is null or length(p_equipment_slot)>80 or p_source_note is null or length(p_source_note)>1000 then raise exception 'Invalid loot drop' using errcode='22023'; end if;
 insert into public.guild_raid_loot_drops(operation_id,item_name,item_level,equipment_slot,source_note,recorded_by) values(p_operation_id,btrim(p_item_name),p_item_level,p_equipment_slot,p_source_note,v_actor) returning id into v_id;
 insert into public.guild_audit_events(guild_id,actor_id,action,target_table,target_id,metadata) values(v_guild_id,v_actor,'guild.loot_drop_recorded','guild_raid_loot_drops',v_id,jsonb_build_object('operation_id',p_operation_id)); return v_id;
end; $$;

create or replace function public.set_guild_raid_loot_candidate(p_loot_drop_id uuid,p_guild_member_id uuid,p_interest text,p_factual_context text default '') returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
 select operation.guild_id into v_guild_id from public.guild_raid_loot_drops drop_row join public.guild_raid_operations operation on operation.id=drop_row.operation_id where drop_row.id=p_loot_drop_id;
 if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then raise exception 'Loot Council or Guild leadership required' using errcode='42501'; end if;
 if p_interest not in ('need','offspec','pass') or p_factual_context is null or length(p_factual_context)>1000 or not exists(select 1 from public.guild_members where id=p_guild_member_id and guild_id=v_guild_id) then raise exception 'Invalid loot candidate' using errcode='22023'; end if;
 insert into public.guild_raid_loot_candidates(loot_drop_id,guild_member_id,interest,factual_context,recorded_by) values(p_loot_drop_id,p_guild_member_id,p_interest,p_factual_context,v_actor) on conflict(loot_drop_id,guild_member_id) do update set interest=excluded.interest,factual_context=excluded.factual_context,recorded_by=excluded.recorded_by;
 insert into public.guild_audit_events(guild_id,actor_id,action,target_table,target_id,metadata) values(v_guild_id,v_actor,'guild.loot_candidate_recorded','guild_raid_loot_candidates',p_loot_drop_id,jsonb_build_object('guild_member_id',p_guild_member_id,'interest',p_interest));
end; $$;

create or replace function public.cast_guild_raid_loot_vote(p_loot_drop_id uuid,p_candidate_id uuid,p_rationale text default '') returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid;
begin
 select operation.guild_id into v_guild_id from public.guild_raid_loot_drops drop_row join public.guild_raid_operations operation on operation.id=drop_row.operation_id where drop_row.id=p_loot_drop_id;
 if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then raise exception 'Loot Council or Guild leadership required' using errcode='42501'; end if;
 if p_rationale is null or length(p_rationale)>1000 or not exists(select 1 from public.guild_raid_loot_candidates where id=p_candidate_id and loot_drop_id=p_loot_drop_id) then raise exception 'Invalid loot vote' using errcode='22023'; end if;
 insert into public.guild_raid_loot_votes(loot_drop_id,candidate_id,voter_id,rationale) values(p_loot_drop_id,p_candidate_id,v_actor,p_rationale) on conflict(loot_drop_id,voter_id) do update set candidate_id=excluded.candidate_id,rationale=excluded.rationale,created_at=now();
 insert into public.guild_audit_events(guild_id,actor_id,action,target_table,target_id,metadata) values(v_guild_id,v_actor,'guild.loot_vote_cast','guild_raid_loot_votes',p_loot_drop_id,jsonb_build_object('candidate_id',p_candidate_id));
end; $$;

create or replace function public.award_guild_raid_loot(p_loot_drop_id uuid,p_candidate_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_guild_id uuid; v_id uuid;
begin
 select operation.guild_id into v_guild_id from public.guild_raid_loot_drops drop_row join public.guild_raid_operations operation on operation.id=drop_row.operation_id where drop_row.id=p_loot_drop_id;
 if v_actor is null or v_guild_id is null or not private.can_manage_guild_loot(v_guild_id) then raise exception 'Loot Council or Guild leadership required' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason))=0 or length(p_reason)>1000 or not exists(select 1 from public.guild_raid_loot_candidates where id=p_candidate_id and loot_drop_id=p_loot_drop_id) then raise exception 'Invalid loot award' using errcode='22023'; end if;
 insert into public.guild_raid_loot_awards(loot_drop_id,candidate_id,reason,awarded_by) values(p_loot_drop_id,p_candidate_id,btrim(p_reason),v_actor) returning id into v_id;
 insert into public.guild_audit_events(guild_id,actor_id,action,target_table,target_id,metadata) values(v_guild_id,v_actor,'guild.loot_awarded','guild_raid_loot_awards',v_id,jsonb_build_object('loot_drop_id',p_loot_drop_id,'candidate_id',p_candidate_id)); return v_id;
end; $$;

alter table public.guild_raid_loot_drops enable row level security; alter table public.guild_raid_loot_candidates enable row level security; alter table public.guild_raid_loot_votes enable row level security; alter table public.guild_raid_loot_awards enable row level security;
revoke all on public.guild_raid_loot_drops, public.guild_raid_loot_candidates, public.guild_raid_loot_votes, public.guild_raid_loot_awards from anon, authenticated;
grant select on public.guild_raid_loot_drops, public.guild_raid_loot_candidates, public.guild_raid_loot_votes, public.guild_raid_loot_awards to authenticated;
create policy "guild_raid_loot_drops_select" on public.guild_raid_loot_drops for select to authenticated using(private.can_manage_guild_loot_drop(id));
create policy "guild_raid_loot_candidates_select" on public.guild_raid_loot_candidates for select to authenticated using(private.can_manage_guild_loot_drop(loot_drop_id));
create policy "guild_raid_loot_votes_select" on public.guild_raid_loot_votes for select to authenticated using(private.can_manage_guild_loot_drop(loot_drop_id));
create policy "guild_raid_loot_awards_select" on public.guild_raid_loot_awards for select to authenticated using(private.can_manage_guild_loot_drop(loot_drop_id));
revoke all on function public.create_guild_raid_loot_drop(uuid,text,integer,text,text), public.set_guild_raid_loot_candidate(uuid,uuid,text,text), public.cast_guild_raid_loot_vote(uuid,uuid,text), public.award_guild_raid_loot(uuid,uuid,text) from public, anon;
grant execute on function public.create_guild_raid_loot_drop(uuid,text,integer,text,text), public.set_guild_raid_loot_candidate(uuid,uuid,text,text), public.cast_guild_raid_loot_vote(uuid,uuid,text), public.award_guild_raid_loot(uuid,uuid,text) to authenticated;
