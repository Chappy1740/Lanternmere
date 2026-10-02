-- The public Auth API can create a user without going through our signup action.
-- Keep every readable profile name within the same bounds as the app form.
alter table public.profiles add constraint profiles_display_name_valid
  check (
    display_name = btrim(display_name)
    and display_name ~ '^[[:graph:] ]{2,32}$'
    and position('@' in display_name) = 0
  );

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if v_display_name !~ '^[[:graph:] ]{2,32}$' or position('@' in v_display_name) > 0 then
    v_display_name := 'Traveler';
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_display_name);
  return new;
end;
$$;
