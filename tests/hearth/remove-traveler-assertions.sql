-- After migration, inside the caller's BEGIN/ROLLBACK only. No real account reads.
do $$ begin
  if nullif(current_setting('audit.cleanup_character',true),'') is not null then
    if exists(select 1 from public.characters where id=current_setting('audit.cleanup_character')::uuid)
      or exists(select 1 from public.character_lodges where character_id=current_setting('audit.cleanup_character')::uuid) then
      raise exception 'Legacy cleanup left unverified data'; end if;
    if not exists(select 1 from public.event_attendees where event_id=current_setting('audit.cleanup_event')::uuid and character_id is null)
      or not exists(select 1 from public.achievements where id=current_setting('audit.cleanup_achievement')::uuid and character_id is null) then
      raise exception 'Cleanup lost community records'; end if;
  end if;
end $$;
select set_config('audit.removal_owner',gen_random_uuid()::text,true);
select set_config('audit.removal_other',gen_random_uuid()::text,true);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','removal-'||id||'@example.invalid','',now(),now(),now(),'{"display_name":"RemovalFixture"}'
from (values(current_setting('audit.removal_owner')::uuid),(current_setting('audit.removal_other')::uuid)) people(id);
insert into public.app_owned_wow_snapshots(profile_id,region,characters)
values(current_setting('audit.removal_owner')::uuid,'us','[{"id":777777101,"name":"Removalmain","level":90,"realm":{"slug":"stormrage"}},{"id":777777102,"name":"Removalalt","level":90,"realm":{"slug":"stormrage"}}]');
set local role service_role;
select set_config('audit.removal_character',public.claim_owned_wow_character(current_setting('audit.removal_owner')::uuid,'us',
  '{"id":777777101,"name":"Removalmain","level":90,"character_class":{"name":"Rogue"},"faction":{"name":"Alliance"},"realm":{"slug":"stormrage","id":60}}',now())::text,true);
select set_config('audit.removal_alt',public.claim_owned_wow_character(current_setting('audit.removal_owner')::uuid,'us',
  '{"id":777777102,"name":"Removalalt","level":90,"character_class":{"name":"Rogue"},"faction":{"name":"Alliance"},"realm":{"slug":"stormrage","id":60}}',now())::text,true);
reset role;
set constraints all immediate;
insert into public.character_raiderio_history(character_id,source_url,refreshed_at)
values(current_setting('audit.removal_character')::uuid,'https://raider.io/characters/us/stormrage/Removalmain',now());
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('audit.removal_other'),true);
do $$ begin
  begin perform public.remove_owned_traveler(current_setting('audit.removal_character')::uuid);
    raise exception 'Other account removed the Traveler'; exception when insufficient_privilege then null; end;
  if has_table_privilege('authenticated','public.characters','delete') or has_function_privilege('anon','public.remove_owned_traveler(uuid)','execute') then
    raise exception 'Removal privilege boundary failed'; end if;
  begin
    insert into public.characters(profile_id,game_id,region,realm_slug,character_name)
      select auth.uid(),id,'us','stormrage','Unverifiedfixture' from public.games where slug='wow';
    raise exception 'Unverified direct import passed'; exception when check_violation or insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin
    insert into public.characters(profile_id,game_id,region,realm_slug,character_name)
      select current_setting('audit.removal_owner')::uuid,id,'us','stormrage','Unverifiedfixture'
      from public.games where slug='wow';
    raise exception 'Privileged unverified import passed'; exception when check_violation then null; end;
end $$;
insert into public.app_account_access(profile_id,suspended) values(current_setting('audit.removal_owner')::uuid,true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('audit.removal_owner'),true);
do $$ begin
  begin perform public.remove_owned_traveler(current_setting('audit.removal_character')::uuid);
    raise exception 'Suspended account removed a Traveler'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.app_account_access set suspended=false where profile_id=current_setting('audit.removal_owner')::uuid;
set local role authenticated;
select public.remove_owned_traveler(current_setting('audit.removal_character')::uuid);
reset role;
do $$ begin
  if exists(select 1 from public.characters where id=current_setting('audit.removal_character')::uuid)
    or exists(select 1 from public.wow_character_claims where character_id=current_setting('audit.removal_character')::uuid)
    or exists(select 1 from public.character_raiderio_history where character_id=current_setting('audit.removal_character')::uuid) then
    raise exception 'Traveler removal left personal data or its claim'; end if;
  if not exists(select 1 from public.characters where id=current_setting('audit.removal_alt')::uuid)
    or not exists(select 1 from public.profiles where id=current_setting('audit.removal_owner')::uuid) then
    raise exception 'Removal damaged an alternate or the account'; end if;
  begin
    delete from public.wow_character_claims where character_id=current_setting('audit.removal_alt')::uuid;
    raise exception 'Proof removed without removing Traveler'; exception when check_violation then null; end;
end $$;
-- Removal releases the exclusive claim. Re-adding starts a new personal history.
set constraints all deferred;
set local role service_role;
select set_config('audit.removal_readded',public.claim_owned_wow_character(current_setting('audit.removal_owner')::uuid,'us',
  '{"id":777777101,"name":"Removalmain","level":90,"character_class":{"name":"Rogue"},"faction":{"name":"Alliance"},"realm":{"slug":"stormrage","id":60}}',now())::text,true);
reset role;
set constraints all immediate;
do $$ begin
  if current_setting('audit.removal_readded') = current_setting('audit.removal_character')
    or exists(select 1 from public.character_raiderio_history where character_id=current_setting('audit.removal_readded')::uuid) then
    raise exception 'Re-added Traveler reused deleted history'; end if;
end $$;
set local role authenticated;
select public.remove_owned_traveler(current_setting('audit.removal_alt')::uuid);
select public.remove_owned_traveler(current_setting('audit.removal_readded')::uuid);
reset role;
do $$ begin
  if exists(select 1 from public.characters where profile_id=current_setting('audit.removal_owner')::uuid)
    or not exists(select 1 from public.profiles where id=current_setting('audit.removal_owner')::uuid) then
    raise exception 'Last-Traveler removal did not preserve the account'; end if;
end $$;
select 'Traveler removal assertions passed; caller must roll back' as result;
