-- Execute in a rollback-only transaction after the projection migration.
do $$ begin
  if has_function_privilege('anon','public.app_account_logins(uuid[])','execute')
    or has_function_privilege('authenticated','public.app_account_logins(uuid[])','execute')
    or has_function_privilege('authenticated','private.app_account_logins(uuid[])','execute') then
    raise exception 'Member login projection access';
  end if;
  if not has_function_privilege('service_role','public.app_account_logins(uuid[])','execute') then raise exception 'Missing server projection grant'; end if;
end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$ declare ids uuid[]; amount int; begin
  select array_agg(id) into ids from (select id from public.profiles order by id limit 50) p;
  select count(*) into amount from public.app_account_logins(ids);
  if amount <> cardinality(ids) then raise exception 'Projection did not match requested accounts'; end if;
  begin
    perform public.app_account_logins(array_fill('00000000-0000-4000-8000-000000000000'::uuid,array[51]));
    raise exception 'Unbounded login projection';
  exception when invalid_parameter_value then null;
  end;
end $$;
set local role postgres;
select 'OWNER LOGIN PROJECTION CHECKS PASSED; no logins returned to test output' as result;
