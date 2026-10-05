-- Synthetic fixture body. Caller wraps it in BEGIN ... ROLLBACK.
select set_config('audit.hearth_owner', gen_random_uuid()::text, true);
select set_config('audit.hearth_other', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'hearth-' || id || '@example.invalid', '', now(), now(), now(),
  jsonb_build_object('display_name', label)
from (values
  (current_setting('audit.hearth_owner')::uuid, 'HearthOwner'),
  (current_setting('audit.hearth_other')::uuid, 'HearthOther')
) as people(id, label);

insert into public.app_owned_wow_snapshots (profile_id, region, characters, refreshed_at)
values (current_setting('audit.hearth_owner')::uuid, 'us',
  '[{"id":777777001,"name":"Hearthfixture","level":90,"realm":{"slug":"stormrage","name":"Stormrage"}}]'::jsonb,
  now());

set local role service_role;
do $$
declare v_id uuid;
begin
  v_id := public.claim_owned_wow_character(
    current_setting('audit.hearth_owner')::uuid, 'us',
    '{"id":777777001,"name":"Hearthfixture","level":90,"realm":{"id":60,"slug":"stormrage","name":"Stormrage"},"character_class":{"id":4,"name":"Rogue"},"faction":{"name":"Alliance"}}'::jsonb,
    now()
  );
  perform set_config('audit.hearth_character', v_id::text, true);
  if not exists (select 1 from public.characters where id = v_id
      and profile_id = current_setting('audit.hearth_owner')::uuid and is_main)
  then raise exception 'First verified Traveler did not become Main'; end if;
  if not exists (select 1 from public.wow_character_claims where character_id = v_id
      and blizzard_character_id = 777777001)
  then raise exception 'Battle.net claim missing'; end if;
  begin
    perform public.save_verified_wow_character(
      current_setting('audit.hearth_other')::uuid, 'us',
      '{"id":777777001,"name":"Hearthfixture","level":90,"realm":{"id":60,"slug":"stormrage","name":"Stormrage"},"character_class":{"id":4,"name":"Rogue"},"faction":{"name":"Alliance"}}'::jsonb,
      now()
    );
    raise exception 'A second account copied a claimed character';
  exception when unique_violation then null;
  end;
  begin
    perform public.claim_owned_wow_character(
      current_setting('audit.hearth_other')::uuid, 'us',
      '{"id":777777001,"name":"Hearthfixture","level":90,"realm":{"id":60,"slug":"stormrage","name":"Stormrage"},"character_class":{"id":4,"name":"Rogue"},"faction":{"name":"Alliance"}}'::jsonb,
      now()
    );
    raise exception 'An account without the OAuth list claimed a character';
  exception when insufficient_privilege then null;
  end;
  insert into public.app_owned_wow_snapshots (profile_id, region, characters, refreshed_at)
  values (current_setting('audit.hearth_other')::uuid, 'us',
    '[{"id":777777001,"name":"Hearthfixture","level":90,"realm":{"slug":"stormrage","name":"Stormrage"}}]'::jsonb,
    now());
  begin
    perform public.claim_owned_wow_character(
      current_setting('audit.hearth_other')::uuid, 'us',
      '{"id":777777001,"name":"Hearthfixture","level":90,"realm":{"id":60,"slug":"stormrage","name":"Stormrage"},"character_class":{"id":4,"name":"Rogue"},"faction":{"name":"Alliance"}}'::jsonb,
      now()
    );
    raise exception 'Two OAuth lists claimed the same character';
  exception when unique_violation then null;
  end;
  begin
    perform public.claim_owned_wow_character(
      current_setting('audit.hearth_owner')::uuid, 'us',
      '{"id":777777001,"name":"Hearthfixture","level":79,"realm":{"id":60,"slug":"stormrage","name":"Stormrage"},"character_class":{"id":4,"name":"Rogue"},"faction":{"name":"Alliance"}}'::jsonb,
      now()
    );
    raise exception 'Below-threshold character was claimed';
  exception when invalid_parameter_value then null;
  end;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('audit.hearth_other'), true);
do $$ begin
  if exists (select 1 from public.wow_character_claims)
  then raise exception 'Other account read the claim'; end if;
  if has_table_privilege('authenticated', 'public.wow_character_claims', 'insert')
    or has_function_privilege('authenticated',
      'public.claim_owned_wow_character(uuid,text,jsonb,timestamptz)', 'execute')
  then raise exception 'Authenticated direct claim access is open'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('audit.hearth_owner'), true);
do $$ begin
  if (select count(*) from public.wow_character_claims) <> 1
  then raise exception 'Owner cannot see their verified claim'; end if;
end $$;
reset role;

delete from public.characters where id = current_setting('audit.hearth_character')::uuid;
do $$ begin
  if exists (select 1 from public.wow_character_claims
      where character_id = current_setting('audit.hearth_character')::uuid)
  then raise exception 'Deleted Traveler left a claim behind'; end if;
end $$;
select 'Claimed Traveler assertions passed; caller must roll back' as result;
