-- Lodge-private recurring plans are reusable prompts for ordinary Quest Board
-- events. They never create events automatically and do not own RSVPs.
create table public.event_templates (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  activity_type text check (char_length(activity_type) <= 80),
  weekday smallint not null check (weekday between 0 and 6),
  event_time time,
  difficulty text check (char_length(difficulty) <= 80),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_event_templates_lodge_weekday
  on public.event_templates(lodge_id, weekday, event_time);

create index idx_event_templates_created_by
  on public.event_templates(created_by);

create trigger trg_event_templates_updated_at
  before update on public.event_templates
  for each row execute function private.set_updated_at();

create or replace function private.prevent_event_template_identity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lodge_id is distinct from old.lodge_id
    or new.created_by is distinct from old.created_by then
    raise exception 'an event template cannot be moved or reassigned'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_event_templates_prevent_identity_changes
  before update on public.event_templates
  for each row execute function private.prevent_event_template_identity_changes();

alter table public.event_templates enable row level security;

revoke all on table public.event_templates from anon;
grant select, insert, update, delete on table public.event_templates to authenticated;

create policy "event_templates_select_member" on public.event_templates
  for select
  to authenticated
  using (private.is_lodge_member(lodge_id));

create policy "event_templates_insert_member" on public.event_templates
  for insert
  to authenticated
  with check (
    private.is_lodge_member(lodge_id)
    and created_by = (select auth.uid())
  );

create policy "event_templates_update_creator_or_admin" on public.event_templates
  for update
  to authenticated
  using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  with check (private.is_lodge_member(lodge_id));

create policy "event_templates_delete_creator_or_admin" on public.event_templates
  for delete
  to authenticated
  using (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id));
