-- Before the migration, inside the caller's BEGIN/ROLLBACK only.
select set_config('audit.cleanup_owner', gen_random_uuid()::text, true);
select set_config('audit.cleanup_character', gen_random_uuid()::text, true);
select set_config('audit.cleanup_lodge', gen_random_uuid()::text, true);
select set_config('audit.cleanup_event', gen_random_uuid()::text, true);
select set_config('audit.cleanup_achievement', gen_random_uuid()::text, true);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
values(current_setting('audit.cleanup_owner')::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'cleanup-'||current_setting('audit.cleanup_owner')||'@example.invalid','',now(),now(),now(),'{"display_name":"CleanupFixture"}');
insert into public.characters(id,profile_id,game_id,region,realm_slug,character_name)
select current_setting('audit.cleanup_character')::uuid,current_setting('audit.cleanup_owner')::uuid,id,'us','stormrage','Cleanupfixture'
from public.games where slug='wow';
insert into public.lodges(id,name,slug,created_by) values(current_setting('audit.cleanup_lodge')::uuid,'Cleanup Fixture',
  'cleanup-'||current_setting('audit.cleanup_lodge'),current_setting('audit.cleanup_owner')::uuid);
insert into public.character_lodges(character_id,lodge_id) values(current_setting('audit.cleanup_character')::uuid,current_setting('audit.cleanup_lodge')::uuid);
insert into public.events(id,lodge_id,created_by,title,event_date) values(current_setting('audit.cleanup_event')::uuid,current_setting('audit.cleanup_lodge')::uuid,
  current_setting('audit.cleanup_owner')::uuid,'Cleanup Fixture',current_date+1);
insert into public.event_attendees(event_id,profile_id,character_id) values(current_setting('audit.cleanup_event')::uuid,current_setting('audit.cleanup_owner')::uuid,current_setting('audit.cleanup_character')::uuid);
insert into public.achievements(id,lodge_id,character_id,created_by,title,source) values(current_setting('audit.cleanup_achievement')::uuid,current_setting('audit.cleanup_lodge')::uuid,
  current_setting('audit.cleanup_character')::uuid,current_setting('audit.cleanup_owner')::uuid,'Cleanup Fixture','manual');
