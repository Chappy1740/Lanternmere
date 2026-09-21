-- Player-submitted links only. Lanternmere neither runs nor reads Raidbots simulations.
create table public.character_raidbots_reports (
  character_id uuid not null references public.characters(id) on delete cascade,
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  character_name text not null,
  realm_slug text not null,
  region text not null,
  report_url text not null check (report_url ~* '^https://(www\\.)?raidbots\\.com/'),
  upgrade_targets text,
  updated_at timestamptz not null default now(),
  primary key (character_id, lodge_id)
);

create trigger trg_character_raidbots_reports_updated_at before update on public.character_raidbots_reports for each row execute function private.set_updated_at();

alter table public.character_raidbots_reports enable row level security;
revoke all on public.character_raidbots_reports from anon;
grant select, insert, update, delete on public.character_raidbots_reports to authenticated;

create policy "raidbots_reports_select_lodge_member_or_owner" on public.character_raidbots_reports for select to authenticated using (private.owns_character(character_id) or private.is_lodge_member(lodge_id));
create policy "raidbots_reports_insert_owner" on public.character_raidbots_reports for insert to authenticated with check (private.owns_character(character_id) and private.is_lodge_member(lodge_id));
create policy "raidbots_reports_update_owner" on public.character_raidbots_reports for update to authenticated using (private.owns_character(character_id)) with check (private.owns_character(character_id) and private.is_lodge_member(lodge_id));
create policy "raidbots_reports_delete_owner" on public.character_raidbots_reports for delete to authenticated using (private.owns_character(character_id));
