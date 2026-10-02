-- Direct membership deletes have the same consent cleanup as leave/remove RPCs.
-- The trigger also covers cascades and future deletion paths.
-- The original report URL check double-escaped its dots and rejects normal links.
alter table public.character_raidbots_reports
  drop constraint character_raidbots_reports_report_url_check,
  add constraint character_raidbots_reports_report_url_check
    check (report_url ~* '^https://(www[.])?raidbots[.]com/');

create function private.clear_departing_member_character_sharing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.character_lodges sharing using public.characters character
  where sharing.character_id = character.id
    and sharing.lodge_id = old.lodge_id
    and character.profile_id = old.profile_id;

  delete from public.character_raiderio_sharing sharing using public.characters character
  where sharing.character_id = character.id
    and sharing.lodge_id = old.lodge_id
    and character.profile_id = old.profile_id;

  delete from public.character_raidbots_reports report using public.characters character
  where report.character_id = character.id
    and report.lodge_id = old.lodge_id
    and character.profile_id = old.profile_id;

  return old;
end;
$$;

revoke all on function private.clear_departing_member_character_sharing()
  from public, anon, authenticated;

create trigger trg_lodge_member_clear_character_sharing
  after delete on public.lodge_members
  for each row execute function private.clear_departing_member_character_sharing();
