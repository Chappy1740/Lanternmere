-- Run inside a single outer transaction, then ROLLBACK. Creates no Storage object.
do $$
declare
  v_owner uuid;
  v_other uuid;
  v_lodge uuid := gen_random_uuid();
  v_entry uuid := gen_random_uuid();
  v_path text := v_lodge::text || '/' || v_entry::text || '/audit-image.webp';
  v_paths text[];
begin
  select id into v_owner from public.profiles order by id limit 1;
  select id into v_other from public.profiles where id <> v_owner order by id limit 1;
  if v_owner is null or v_other is null then
    raise exception 'Two existing accounts required for Lodge deletion rehearsal';
  end if;

  insert into public.lodges (id, name, slug, created_by)
  values (v_lodge, 'Audit Lodge', 'audit-lodge-' || replace(v_lodge::text, '-', ''), v_owner);
  insert into public.lodge_members (lodge_id, profile_id, role)
  values (v_lodge, v_owner, 'owner');
  insert into public.chronicle_entries (id, lodge_id, author_id, title, body)
  values (v_entry, v_lodge, v_owner, 'Audit Chronicle', 'Synthetic rollback-only entry');
  insert into public.chronicle_media (chronicle_id, lodge_id, uploaded_by, storage_path)
  values (v_entry, v_lodge, v_owner, v_path);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_lodge(v_lodge, 'DELETE Audit Lodge');
    raise exception 'Non-owner Lodge deletion unexpectedly passed';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_paths := public.delete_lodge(v_lodge, 'DELETE Audit Lodge');
  if v_paths is distinct from array[v_path] then
    raise exception 'Lodge deletion did not return its Chronicle Storage path';
  end if;
  if exists (select 1 from public.lodges where id = v_lodge)
    or exists (select 1 from public.chronicle_media where lodge_id = v_lodge) then
    raise exception 'Lodge or Chronicle metadata remained after deletion';
  end if;
end $$;

select 'LODGE DELETION REHEARSAL PASSED; outer transaction must roll back' as result;
