create table public.guild_rank_labels (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  rank_index integer not null check (rank_index >= 0),
  label text not null check (length(btrim(label)) between 1 and 80),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (guild_id, rank_index)
);
create trigger trg_guild_rank_labels_updated_at before update on public.guild_rank_labels for each row execute function private.set_updated_at();
alter table public.guild_rank_labels enable row level security;
revoke all on public.guild_rank_labels from anon;
grant select, insert, update, delete on public.guild_rank_labels to authenticated;
create policy "guild_rank_labels_select_member" on public.guild_rank_labels for select to authenticated using (private.is_guild_member(guild_id));
create policy "guild_rank_labels_write_master" on public.guild_rank_labels for all to authenticated using (private.has_guild_role(guild_id, 'guild_master')) with check (private.has_guild_role(guild_id, 'guild_master') and updated_by = (select auth.uid()));
