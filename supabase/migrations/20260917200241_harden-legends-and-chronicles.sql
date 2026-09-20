-- Milestone 5: keep Lodge records private, attributable, and bound to their Lodge.
update public.achievements set source = 'manual' where source is null;
alter table public.achievements alter column source set default 'manual';
alter table public.achievements alter column source set not null;
alter table public.achievements
  add constraint achievements_source_check check (source in ('blizzard', 'manual'));
create or replace function private.character_shared_with_lodge(p_character_id uuid, p_lodge_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.character_lodges
    where character_id = p_character_id and lodge_id = p_lodge_id
  );
$$;
create or replace function private.validate_achievement_boundary()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.lodge_id is distinct from old.lodge_id or new.created_by is distinct from old.created_by) then
    raise exception 'An achievement cannot be moved or reassigned.';
  end if;
  if new.character_id is not null and not private.character_shared_with_lodge(new.character_id, new.lodge_id) then
    raise exception 'The character is not shared with this Lodge.';
  end if;
  return new;
end;
$$;
create or replace function private.prevent_chronicle_identity_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.lodge_id is distinct from old.lodge_id or new.author_id is distinct from old.author_id then
    raise exception 'A Chronicle cannot be moved or reassigned.';
  end if;
  return new;
end;
$$;
create trigger trg_achievements_validate_boundary before insert or update on public.achievements
for each row execute function private.validate_achievement_boundary();
create trigger trg_chronicles_prevent_identity_changes before update on public.chronicle_entries
for each row execute function private.prevent_chronicle_identity_changes();
