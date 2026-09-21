-- Explicit per-character, per-Lodge consent for public Raider.IO summaries.
create table public.character_raiderio_sharing (
  character_id uuid not null references public.characters(id) on delete cascade,
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  enabled_at timestamptz not null default now(),
  primary key (character_id, lodge_id)
);

create table public.character_raiderio_snapshots (
  character_id uuid primary key references public.characters(id) on delete cascade,
  mythic_plus_score numeric,
  raid_progression jsonb not null default '{}'::jsonb,
  source_url text not null,
  refreshed_at timestamptz not null,
  failure_message text,
  updated_at timestamptz not null default now()
);

create trigger trg_character_raiderio_snapshots_updated_at before update on public.character_raiderio_snapshots for each row execute function private.set_updated_at();

alter table public.character_raiderio_sharing enable row level security;
alter table public.character_raiderio_snapshots enable row level security;
revoke all on public.character_raiderio_sharing, public.character_raiderio_snapshots from anon;
grant select, insert, delete on public.character_raiderio_sharing to authenticated;
grant select on public.character_raiderio_snapshots to authenticated;
grant insert, update on public.character_raiderio_snapshots to service_role;

create policy "raiderio_sharing_select_owner_or_lodge_member" on public.character_raiderio_sharing for select to authenticated using (private.owns_character(character_id) or private.is_lodge_member(lodge_id));
create policy "raiderio_sharing_insert_owner" on public.character_raiderio_sharing for insert to authenticated with check (private.owns_character(character_id) and private.is_lodge_member(lodge_id));
create policy "raiderio_sharing_delete_owner" on public.character_raiderio_sharing for delete to authenticated using (private.owns_character(character_id));
create policy "raiderio_snapshots_select_selected_lodge" on public.character_raiderio_snapshots for select to authenticated using (private.owns_character(character_id) or exists (select 1 from public.character_raiderio_sharing sharing where sharing.character_id = character_raiderio_snapshots.character_id and private.is_lodge_member(sharing.lodge_id)));
