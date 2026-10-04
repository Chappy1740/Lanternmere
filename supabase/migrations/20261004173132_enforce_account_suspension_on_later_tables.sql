-- Restore the account-suspension defense in depth for RLS tables added after
-- 20261002092258_account_access_management.sql. The PostgREST pre-request hook
-- remains the primary gate; this policy also protects other RLS access paths.
do $$
declare target_table record;
begin
  for target_table in
    select namespace.nspname, relation.relname
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where relation.relrowsecurity
      and relation.relkind = 'r'
      and (
        (namespace.nspname = 'public' and relation.relname <> 'app_account_access')
        or (namespace.nspname = 'storage' and relation.relname = 'objects')
      )
      and not exists (
        select 1 from pg_policy policy
        where policy.polrelid = relation.oid
          and policy.polname = 'app_account_active'
      )
  loop
    execute format(
      'create policy app_account_active on %I.%I as restrictive for all to authenticated using ((select private.app_account_active())) with check ((select private.app_account_active()))',
      target_table.nspname,
      target_table.relname
    );
  end loop;
end $$;
