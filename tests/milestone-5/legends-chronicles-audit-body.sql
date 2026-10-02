-- Synthetic current-schema assertions. Run inside a transaction and roll back.
select set_config('audit.owner', gen_random_uuid()::text, true);
select set_config('audit.member', gen_random_uuid()::text, true);
select set_config('audit.lodge_a', gen_random_uuid()::text, true);
select set_config('audit.lodge_b', gen_random_uuid()::text, true);
select set_config('audit.owner_character', gen_random_uuid()::text, true);
select set_config('audit.member_character', gen_random_uuid()::text, true);
select set_config('audit.achievement', gen_random_uuid()::text, true);
select set_config('audit.blizzard', gen_random_uuid()::text, true);
select set_config('audit.chronicle_a', gen_random_uuid()::text, true);
select set_config('audit.chronicle_b', gen_random_uuid()::text, true);
select set_config('audit.media', gen_random_uuid()::text, true);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  (current_setting('audit.owner')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm5-owner-' || current_setting('audit.owner') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditOwner"}'::jsonb),
  (current_setting('audit.member')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm5-member-' || current_setting('audit.member') || '@example.invalid', '', now(), now(), now(), '{"display_name":"AuditMember"}'::jsonb);
insert into public.lodges (id, name, slug, created_by)
values
  (current_setting('audit.lodge_a')::uuid, 'M5 Audit A', 'm5-a-' || current_setting('audit.lodge_a'), current_setting('audit.owner')::uuid),
  (current_setting('audit.lodge_b')::uuid, 'M5 Audit B', 'm5-b-' || current_setting('audit.lodge_b'), current_setting('audit.owner')::uuid);
insert into public.lodge_members (lodge_id, profile_id, role)
values
  (current_setting('audit.lodge_a')::uuid, current_setting('audit.owner')::uuid, 'owner'),
  (current_setting('audit.lodge_a')::uuid, current_setting('audit.member')::uuid, 'member'),
  (current_setting('audit.lodge_b')::uuid, current_setting('audit.owner')::uuid, 'owner'),
  (current_setting('audit.lodge_b')::uuid, current_setting('audit.member')::uuid, 'member');
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select current_setting('audit.owner_character')::uuid, current_setting('audit.owner')::uuid,
  game.id, 'us', 'stormrage', 'Auditowner' from public.games game where game.slug = 'wow';
insert into public.characters (id, profile_id, game_id, region, realm_slug, character_name)
select current_setting('audit.member_character')::uuid, current_setting('audit.member')::uuid,
  game.id, 'us', 'stormrage', 'Auditmember' from public.games game where game.slug = 'wow';
insert into public.character_lodges (character_id, lodge_id)
values
  (current_setting('audit.owner_character')::uuid, current_setting('audit.lodge_a')::uuid),
  (current_setting('audit.member_character')::uuid, current_setting('audit.lodge_a')::uuid);
insert into public.chronicle_entries (id, lodge_id, author_id, title, body)
values
  (current_setting('audit.chronicle_a')::uuid, current_setting('audit.lodge_a')::uuid,
    current_setting('audit.member')::uuid, 'A Lodge story', 'A shared memory.'),
  (current_setting('audit.chronicle_b')::uuid, current_setting('audit.lodge_b')::uuid,
    current_setting('audit.member')::uuid, 'B Lodge story', 'Another shared memory.');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.member'), true);
do $$
begin
  begin
    insert into public.achievements (lodge_id, created_by, character_id, title, source)
    values (current_setting('audit.lodge_a')::uuid, current_setting('audit.member')::uuid,
      current_setting('audit.owner_character')::uuid, 'Improper credit', 'manual');
    raise exception 'Another member character was credited';
  exception when check_violation then null;
  end;
end;
$$;
insert into public.achievements (id, lodge_id, created_by, character_id, title, source)
values (current_setting('audit.achievement')::uuid, current_setting('audit.lodge_a')::uuid,
  current_setting('audit.member')::uuid, current_setting('audit.member_character')::uuid,
  'Manual triumph', 'manual');
insert into public.chronicle_media (id, chronicle_id, lodge_id, uploaded_by, storage_path)
values (current_setting('audit.media')::uuid, current_setting('audit.chronicle_a')::uuid,
  current_setting('audit.lodge_a')::uuid, current_setting('audit.member')::uuid,
  current_setting('audit.lodge_a') || '/' || current_setting('audit.chronicle_a') || '/valid.png');
do $$
begin
  begin
    insert into public.chronicle_media (chronicle_id, lodge_id, uploaded_by, storage_path)
    values (current_setting('audit.chronicle_a')::uuid, current_setting('audit.lodge_b')::uuid,
      current_setting('audit.member')::uuid,
      current_setting('audit.lodge_b') || '/' || current_setting('audit.chronicle_b') || '/wrong.png');
    raise exception 'Cross-Lodge Chronicle media was accepted';
  exception when check_violation then null;
  end;
  if not exists (
    select 1 from public.search_lodge_achievement_ids(
      current_setting('audit.lodge_a')::uuid, 'Auditmember', 101, 0) result
    where result.id = current_setting('audit.achievement')::uuid
  ) then raise exception 'Character-name achievement search failed'; end if;
  if not exists (
    select 1 from public.search_lodge_chronicle_ids(
      current_setting('audit.lodge_a')::uuid, 'Lodge story', null, null, 101, 0) result
    where result.id = current_setting('audit.chronicle_a')::uuid
  ) then raise exception 'Chronicle search failed'; end if;
end;
$$;
reset role;

insert into public.achievements (id, lodge_id, created_by, character_id, title, source)
values (current_setting('audit.blizzard')::uuid, current_setting('audit.lodge_a')::uuid,
  current_setting('audit.member')::uuid, current_setting('audit.member_character')::uuid,
  'Trusted Blizzard record', 'blizzard');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.member'), true);
do $$
declare v_count integer;
begin
  update public.achievements set title = 'Rewritten'
  where id = current_setting('audit.blizzard')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Browser changed a Blizzard record'; end if;
  delete from public.achievements where id = current_setting('audit.blizzard')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Browser deleted a Blizzard record'; end if;
end;
$$;
reset role;

do $$
begin
  begin
    update public.achievements set title = '  '
    where id = current_setting('audit.achievement')::uuid;
    raise exception 'Blank achievement title was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.chronicle_entries set body = ''
    where id = current_setting('audit.chronicle_a')::uuid;
    raise exception 'Blank Chronicle body was accepted';
  exception when check_violation then null;
  end;
end;
$$;

delete from public.lodge_members
where lodge_id = current_setting('audit.lodge_a')::uuid
  and profile_id = current_setting('audit.member')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.member'), true);
do $$
declare v_count integer;
begin
  delete from public.achievements where id = current_setting('audit.achievement')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Former member deleted an achievement'; end if;
  delete from public.chronicle_entries where id = current_setting('audit.chronicle_a')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Former member deleted a Chronicle'; end if;
  delete from public.chronicle_media where id = current_setting('audit.media')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Former member deleted Chronicle media'; end if;
end;
$$;
reset role;
