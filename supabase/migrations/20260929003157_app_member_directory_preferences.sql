-- An app-wide directory alias is separate from Guild/Lodge identity and opt-in.
-- No email, legal name, IP address, or auth metadata is copied here.
create table public.app_member_directory_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  alias text,
  visible_to_owner boolean not null default false,
  updated_at timestamptz not null default now(),
  check (alias is null or (
    length(btrim(alias)) between 2 and 32
    and alias !~ '[[:cntrl:]@]'
  )),
  check (not visible_to_owner or alias is not null)
);

create trigger trg_app_member_directory_preferences_updated_at
  before update on public.app_member_directory_preferences
  for each row execute function private.set_updated_at();

alter table public.app_member_directory_preferences enable row level security;
revoke all on public.app_member_directory_preferences from anon, authenticated;
grant select, insert, update on public.app_member_directory_preferences to authenticated;
grant select on public.app_member_directory_preferences to service_role;

create policy "app_member_directory_preferences_select_self"
  on public.app_member_directory_preferences for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "app_member_directory_preferences_insert_self"
  on public.app_member_directory_preferences for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "app_member_directory_preferences_update_self"
  on public.app_member_directory_preferences for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
