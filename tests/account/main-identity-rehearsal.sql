-- Current-schema fixture body. Run only after the pending acknowledgment
-- migration inside one caller-owned BEGIN ... ROLLBACK transaction.
-- Selects two existing, nonsuspended accounts without exposing identifiers.
-- Test rows are visible only inside the transaction and are rolled back.
do $$
declare
  v_first uuid;
  v_second uuid;
begin
  select p.id into v_first
  from public.profiles p
  where not exists (
    select 1 from public.app_account_access a
    where a.profile_id = p.id and a.suspended
  )
  order by p.id limit 1;
  select p.id into v_second
  from public.profiles p
  where p.id <> v_first and not exists (
    select 1 from public.app_account_access a
    where a.profile_id = p.id and a.suspended
  )
  order by p.id limit 1;
  if v_first is null or v_second is null then
    raise exception 'Two active fixture accounts are required';
  end if;
  insert into public.app_main_identity_acknowledgments(profile_id)
    values (v_first), (v_second);
  perform set_config('request.jwt.claim.sub', v_first::text, true);
end $$;

set local role authenticated;
do $$
begin
  if (select count(*) from public.app_main_identity_acknowledgments) <> 1 then
    raise exception 'Owner-only acknowledgment isolation failed';
  end if;
  if has_table_privilege(current_user, 'public.app_main_identity_acknowledgments', 'UPDATE')
     or has_table_privilege(current_user, 'public.app_main_identity_acknowledgments', 'DELETE') then
    raise exception 'Authenticated user has mutation privilege beyond insert';
  end if;
end $$;
reset role;
select 'MAIN IDENTITY REHEARSAL PASSED' as result;
