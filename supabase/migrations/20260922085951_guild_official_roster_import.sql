-- Official Blizzard roster data is a timestamped, unclaimed Guild roster. It
-- never creates Lanternmere accounts, Guild membership, or leadership roles.
create table public.guild_blizzard_roster_snapshots (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  region text not null check (region in ('us', 'eu', 'kr', 'tw')),
  realm_slug text not null,
  guild_name text not null,
  source_url text not null,
  refreshed_at timestamptz not null,
  failure_message text,
  updated_at timestamptz not null default now()
);
create trigger trg_guild_blizzard_roster_snapshots_updated_at before update on public.guild_blizzard_roster_snapshots for each row execute function private.set_updated_at();

create table public.guild_roster_entries (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  blizzard_character_id bigint not null,
  character_name text not null,
  realm_slug text not null,
  class_name text,
  rank_index integer not null,
  source_refreshed_at timestamptz not null,
  primary key (guild_id, blizzard_character_id)
);
create index idx_guild_roster_entries_guild_rank on public.guild_roster_entries(guild_id, rank_index, character_name);

alter table public.guild_blizzard_roster_snapshots enable row level security;
alter table public.guild_roster_entries enable row level security;
revoke all on public.guild_blizzard_roster_snapshots, public.guild_roster_entries from anon;
grant select on public.guild_blizzard_roster_snapshots, public.guild_roster_entries to authenticated;

create policy "guild_roster_snapshot_select_visible_scope" on public.guild_blizzard_roster_snapshots for select to authenticated using (
  private.can_lead_guild(guild_id) or (private.is_guild_member(guild_id) and (select member_portal_enabled from public.guilds where id = guild_id))
);
create policy "guild_roster_entries_select_visible_scope" on public.guild_roster_entries for select to authenticated using (
  private.can_lead_guild(guild_id) or (private.is_guild_member(guild_id) and (select member_portal_enabled from public.guilds where id = guild_id))
);
