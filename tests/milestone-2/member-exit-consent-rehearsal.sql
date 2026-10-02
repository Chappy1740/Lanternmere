-- Run against the current schema only. All synthetic rows are rolled back.
-- Never run the historical milestone-2 baseline against the linked project.
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_lodge uuid := gen_random_uuid();
  v_member_row uuid := gen_random_uuid();
  v_owner_character uuid := gen_random_uuid();
  v_member_character uuid := gen_random_uuid();
  v_wow_game uuid;
begin
  select id into v_wow_game from public.games where slug = 'wow';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2-owner-' || v_owner || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditOwner"}'::jsonb),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2-member-' || v_member || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditMember"}'::jsonb);
  insert into public.lodges (id, name, slug, created_by)
  values (v_lodge, 'M2 Audit Lodge', 'm2-audit-' || v_lodge, v_owner);
  insert into public.lodge_members (lodge_id, profile_id, role)
  values (v_lodge, v_owner, 'owner');
  insert into public.lodge_members (id, lodge_id, profile_id, role)
  values (v_member_row, v_lodge, v_member, 'member');
  insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
  values
    (v_owner_character, v_owner, v_wow_game, 'us', 'stormrage', 'Auditowner'),
    (v_member_character, v_member, v_wow_game, 'us', 'stormrage', 'Auditmember');
  insert into public.character_lodges (character_id, lodge_id)
  values (v_owner_character, v_lodge), (v_member_character, v_lodge);
  insert into public.character_raiderio_sharing (character_id, lodge_id)
  values (v_owner_character, v_lodge), (v_member_character, v_lodge);
  insert into public.character_raidbots_reports
    (character_id, lodge_id, character_name, realm_slug, region, report_url)
  values
    (v_owner_character, v_lodge, 'Auditowner', 'stormrage', 'us', 'https://www.raidbots.com/simbot/report/owner'),
    (v_member_character, v_lodge, 'Auditmember', 'stormrage', 'us', 'https://www.raidbots.com/simbot/report/member');

  -- This bypasses both Lodge-management RPCs, just as an ordinary direct delete can.
  delete from public.lodge_members where id = v_member_row;
  if exists (select 1 from public.character_lodges where character_id = v_member_character and lodge_id = v_lodge)
    or exists (select 1 from public.character_raiderio_sharing where character_id = v_member_character and lodge_id = v_lodge)
    or exists (select 1 from public.character_raidbots_reports where character_id = v_member_character and lodge_id = v_lodge)
  then raise exception 'departed member sharing survived'; end if;
  if (select count(*) from public.character_lodges where character_id = v_owner_character and lodge_id = v_lodge) <> 1
    or (select count(*) from public.character_raiderio_sharing where character_id = v_owner_character and lodge_id = v_lodge) <> 1
    or (select count(*) from public.character_raidbots_reports where character_id = v_owner_character and lodge_id = v_lodge) <> 1
  then raise exception 'another member sharing was removed'; end if;

  insert into public.lodge_members (lodge_id, profile_id, role)
  values (v_lodge, v_member, 'member');
  if exists (select 1 from public.character_lodges where character_id = v_member_character and lodge_id = v_lodge)
    or exists (select 1 from public.character_raiderio_sharing where character_id = v_member_character and lodge_id = v_lodge)
    or exists (select 1 from public.character_raidbots_reports where character_id = v_member_character and lodge_id = v_lodge)
  then raise exception 'sharing revived on re-entry'; end if;
end;
$$;

rollback;
select 'M2 SHARING REHEARSAL PASSED AND ROLLED BACK' as result;
