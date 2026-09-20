-- Browser-authenticated members may create only Lanternmere records.
-- Trusted server imports use the service role and may create Blizzard records.
drop policy "achievements_insert_member" on public.achievements;
create policy "achievements_insert_member" on public.achievements
  for insert to authenticated with check (
    private.is_lodge_member(lodge_id)
    and created_by = (select auth.uid())
    and source = 'manual'
  );

create function private.prevent_achievement_source_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source is distinct from old.source then
    raise exception 'An achievement source cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger trg_achievements_prevent_source_change
  before update on public.achievements
  for each row execute function private.prevent_achievement_source_change();
