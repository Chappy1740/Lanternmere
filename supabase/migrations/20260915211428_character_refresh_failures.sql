-- Successful imports remain in character_snapshots. Failures never overwrite them.
create table public.character_refresh_failures (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  attempted_at timestamptz not null,
  failure_code text not null check (failure_code in (
    'authentication', 'unavailable', 'throttled', 'integration', 'save'
  )),
  created_at timestamptz not null default now(),
  check (isfinite(attempted_at))
);

create index idx_character_refresh_failures_latest
  on public.character_refresh_failures(character_id, attempted_at desc);

alter table public.character_refresh_failures enable row level security;
revoke all on public.character_refresh_failures from public, anon, authenticated;
grant select on public.character_refresh_failures to authenticated;
grant select, insert on public.character_refresh_failures to service_role;

create policy "character_refresh_failures_read_visible_character"
  on public.character_refresh_failures for select to authenticated
  using (private.can_read_character(character_id));

-- No ordinary-client write policy/grant. The server verifies ownership before
-- inserting a failure; neither owner IDs nor trusted outcomes come from a form.
