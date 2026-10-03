-- Owner-only, timestamped Raider.IO history. Existing Lodge/Guild sharing does not expose it.
alter table public.character_raiderio_snapshots
  add column season_label text check (season_label is null or length(season_label) <= 80),
  add column best_runs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(best_runs) = 'array');

create table public.character_raiderio_history (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  mythic_plus_score numeric,
  season_label text check (season_label is null or length(season_label) <= 80),
  best_runs jsonb not null default '[]'::jsonb check (jsonb_typeof(best_runs) = 'array'),
  raid_progression jsonb not null default '{}'::jsonb,
  source_url text not null,
  refreshed_at timestamptz not null,
  unique (character_id, refreshed_at)
);
create index idx_character_raiderio_history_character_time
  on public.character_raiderio_history(character_id, refreshed_at desc);
alter table public.character_raiderio_history enable row level security;
revoke all on public.character_raiderio_history from public, anon, authenticated;
grant select on public.character_raiderio_history to authenticated;
create policy raiderio_history_owner_read on public.character_raiderio_history
  for select to authenticated using (private.owns_character(character_id));

insert into public.character_raiderio_history
  (character_id, mythic_plus_score, season_label, best_runs,
    raid_progression, source_url, refreshed_at)
select character_id, mythic_plus_score, season_label, best_runs,
  raid_progression, source_url, refreshed_at
from public.character_raiderio_snapshots;

create function private.capture_raiderio_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.failure_message is null and (tg_op = 'INSERT' or
    new.refreshed_at is distinct from old.refreshed_at) then
    insert into public.character_raiderio_history
      (character_id, mythic_plus_score, season_label, best_runs,
        raid_progression, source_url, refreshed_at)
    values (new.character_id, new.mythic_plus_score, new.season_label,
      new.best_runs, new.raid_progression, new.source_url, new.refreshed_at)
    on conflict (character_id, refreshed_at) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_raiderio_history() from public, anon, authenticated;
create trigger trg_capture_raiderio_history
  after insert or update on public.character_raiderio_snapshots
  for each row execute function private.capture_raiderio_history();
