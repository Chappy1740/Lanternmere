-- A campaign is a Lodge-private, manually maintained goal. It does not infer
-- progress from external data or create events, assignments, or attendance.
create table public.lodge_campaigns (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  goal text check (char_length(goal) <= 500),
  target_count integer check (target_count is null or target_count > 0),
  progress_count integer not null default 0 check (progress_count >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_count is null or progress_count <= target_count)
);

create index idx_lodge_campaigns_lodge_status_created
  on public.lodge_campaigns(lodge_id, status, created_at desc);

create index idx_lodge_campaigns_created_by on public.lodge_campaigns(created_by);

create trigger trg_lodge_campaigns_updated_at
  before update on public.lodge_campaigns
  for each row execute function private.set_updated_at();

create or replace function private.prevent_lodge_campaign_identity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lodge_id is distinct from old.lodge_id
    or new.created_by is distinct from old.created_by then
    raise exception 'a campaign cannot be moved or reassigned' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_lodge_campaigns_prevent_identity_changes
  before update on public.lodge_campaigns
  for each row execute function private.prevent_lodge_campaign_identity_changes();

alter table public.lodge_campaigns enable row level security;
revoke all on table public.lodge_campaigns from anon;
grant select, insert, update, delete on table public.lodge_campaigns to authenticated;

create policy "lodge_campaigns_select_member" on public.lodge_campaigns
  for select to authenticated using (private.is_lodge_member(lodge_id));

create policy "lodge_campaigns_insert_member" on public.lodge_campaigns
  for insert to authenticated
  with check (private.is_lodge_member(lodge_id) and created_by = (select auth.uid()));

create policy "lodge_campaigns_update_creator_or_admin" on public.lodge_campaigns
  for update to authenticated
  using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_member(lodge_id));

create policy "lodge_campaigns_delete_creator_or_admin" on public.lodge_campaigns
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id));
