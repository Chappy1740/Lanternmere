-- Run only inside a transaction after the new migration. Roll back the entire transaction.
do $$ declare actor uuid; other_actor uuid; begin
  if has_table_privilege('authenticated','public.app_account_access','update') then raise exception 'Member can change suspension'; end if;
  if has_function_privilege('authenticated','public.set_app_account_access(uuid,uuid,boolean)','execute') then raise exception 'Member can invoke owner access RPC'; end if;
  if has_table_privilege('anon','public.app_owned_wow_snapshots','select') then raise exception 'Anonymous character access'; end if;
  if has_function_privilege('anon','private.app_account_active()','execute') then raise exception 'Anonymous private account check'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relkind='r' and c.relname<>'app_account_access' and not exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='app_account_active' and not p.polpermissive)) then raise exception 'Suspension policy missing'; end if;
  if not exists(select 1 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects' and p.polname='app_account_active' and not p.polpermissive) then raise exception 'Storage suspension policy missing'; end if;
  select id into actor from public.profiles order by id limit 1;
  select id into other_actor from public.profiles where id<>actor order by id limit 1;
  if actor is null or other_actor is null then raise exception 'Two existing accounts required for rollback-only assertions'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  insert into public.app_account_access(profile_id,suspended) values(actor,true) on conflict(profile_id) do update set suspended=true;
  insert into public.app_owned_wow_snapshots(profile_id,region,characters) values(actor,'us','[]'),(other_actor,'us','[]');
end $$;
set local role authenticated;
do $$ begin
  if private.app_account_active() then raise exception 'Suspended account remained active'; end if;
  if exists(select 1 from public.profiles) then raise exception 'Suspended JWT can read profiles'; end if;
  if exists(select 1 from public.app_owned_wow_snapshots) then raise exception 'Suspended JWT can read characters'; end if;
  begin perform public.check_app_account_access(); raise exception 'RPC pre-request did not reject'; exception when insufficient_privilege then null; end;
  begin perform public.record_app_activity(); raise exception 'Suspended activity update permitted'; exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
update public.app_account_access set suspended=false where profile_id=auth.uid();
set local role authenticated;
do $$ begin
  if not private.app_account_active() then raise exception 'Restored account remained suspended'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Restored profile unavailable'; end if;
  if (select count(*) from public.app_owned_wow_snapshots)<>1 then raise exception 'Personal characters are not restricted to self'; end if;
  perform public.check_app_account_access();
  perform public.record_app_activity();
end $$;
set local role postgres;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select public.check_app_account_access();
set local role postgres;
select 'ACCOUNT ACCESS REHEARSAL PASSED; outer transaction must roll back' as result;
