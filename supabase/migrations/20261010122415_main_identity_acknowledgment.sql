-- Existing members must explicitly accept owner visibility of their verified Main.
-- Do not backfill from the former optional directory nickname preference.
create table public.app_main_identity_acknowledgments (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  policy_version text not null default '2026-10' check (policy_version = '2026-10'),
  acknowledged_at timestamptz not null default now()
);

alter table public.app_main_identity_acknowledgments enable row level security;
revoke all on public.app_main_identity_acknowledgments from public, anon, authenticated;
grant all on public.app_main_identity_acknowledgments to service_role;
grant select (profile_id, policy_version, acknowledged_at)
  on public.app_main_identity_acknowledgments to authenticated;
grant insert (profile_id) on public.app_main_identity_acknowledgments to authenticated;

create policy main_identity_ack_self_read on public.app_main_identity_acknowledgments
  for select to authenticated using (profile_id = (select auth.uid()));
create policy main_identity_ack_self_insert on public.app_main_identity_acknowledgments
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy app_account_active on public.app_main_identity_acknowledgments
  as restrictive for all to authenticated
  using ((select private.app_account_active()))
  with check ((select private.app_account_active()));
