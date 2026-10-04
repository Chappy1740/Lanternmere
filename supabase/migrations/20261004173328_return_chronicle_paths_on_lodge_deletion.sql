-- Capture Chronicle Storage paths while the Lodge row is locked, before its
-- Chronicle metadata cascades away. The server removes objects after commit.
drop function public.delete_lodge(uuid, text);

create function public.delete_lodge(p_lodge_id uuid, p_confirmation text)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_lodge public.lodges;
  v_media_paths text[];
begin
  select * into v_lodge from public.lodges where id = p_lodge_id for update;
  if v_actor is null or not found or not exists (
    select 1 from public.lodge_members
    where lodge_id = p_lodge_id and profile_id = v_actor and role = 'owner'
  ) then
    raise exception 'delete_lodge: Lodge owner required' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'DELETE ' || v_lodge.name then
    raise exception 'delete_lodge: confirmation does not match' using errcode = '22023';
  end if;

  select coalesce(array_agg(storage_path order by storage_path), '{}'::text[])
  into v_media_paths
  from public.chronicle_media
  where lodge_id = p_lodge_id;

  delete from public.lodges where id = v_lodge.id;
  return v_media_paths;
end;
$$;

revoke all on function public.delete_lodge(uuid, text) from public, anon;
grant execute on function public.delete_lodge(uuid, text) to authenticated;
