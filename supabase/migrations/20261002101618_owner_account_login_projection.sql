-- Narrow login projection for the server-authorized app-owner management page.
-- Never expose auth.users, password hashes, tokens, or metadata to members.
create function private.app_account_logins(p_profile_ids uuid[])
returns table(profile_id uuid, login text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
  if p_profile_ids is null or cardinality(p_profile_ids)>50 then
    raise invalid_parameter_value using message='At most 50 account references are allowed';
  end if;
  return query select u.id,u.email::text from auth.users u where u.id=any(p_profile_ids);
end $$;
revoke all on function private.app_account_logins(uuid[]) from public, anon, authenticated;
grant execute on function private.app_account_logins(uuid[]) to service_role;
create function public.app_account_logins(p_profile_ids uuid[])
returns table(profile_id uuid, login text)
language sql stable security invoker set search_path = '' as $$
  select * from private.app_account_logins(p_profile_ids)
$$;
revoke all on function public.app_account_logins(uuid[]) from public, anon, authenticated;
grant execute on function public.app_account_logins(uuid[]) to service_role;
