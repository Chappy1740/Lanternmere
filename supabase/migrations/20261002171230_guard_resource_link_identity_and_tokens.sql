-- Milestone 0 audit hardening: keep dormant resource links attributable to
-- their original Lodge and author, and make token-table API denial explicit.
create or replace function private.prevent_resource_link_identity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lodge_id is distinct from old.lodge_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A resource link cannot be moved or reassigned.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_resource_link_identity_changes()
  from public, anon, authenticated;

create trigger trg_resource_links_prevent_identity_changes
  before update on public.resource_links
  for each row execute function private.prevent_resource_link_identity_changes();

-- RLS has no policies for this table; explicit grants provide a second gate.
revoke all on table public.game_account_tokens from public, anon, authenticated;
