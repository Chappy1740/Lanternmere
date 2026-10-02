-- Bind Chronicle media to its entry and to the entry's private Storage prefix.
create or replace function private.validate_chronicle_media_boundary()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.chronicle_entries entry
    where entry.id = new.chronicle_id and entry.lodge_id = new.lodge_id
  ) or new.storage_path not like new.lodge_id::text || '/' || new.chronicle_id::text || '/%'
  then
    raise exception 'Chronicle media must match its Lodge and entry.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_chronicle_media_boundary() from public, anon, authenticated;
create trigger trg_chronicle_media_validate_boundary
  before insert or update on public.chronicle_media
  for each row execute function private.validate_chronicle_media_boundary();

drop policy "chronicle_media_insert_author_or_admin" on public.chronicle_media;
create policy "chronicle_media_insert_author_or_admin" on public.chronicle_media
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and private.is_lodge_member(chronicle_media.lodge_id)
    and storage_path like chronicle_media.lodge_id::text || '/' || chronicle_media.chronicle_id::text || '/%'
    and exists (
      select 1 from public.chronicle_entries entry
      where entry.id = chronicle_media.chronicle_id
        and entry.lodge_id = chronicle_media.lodge_id
        and (entry.author_id = (select auth.uid()) or private.is_lodge_admin(entry.lodge_id))
    )
  );

-- Membership loss revokes destructive permissions, including Storage objects.
drop policy "chronicle_media_delete_uploader_or_admin" on public.chronicle_media;
create policy "chronicle_media_delete_uploader_or_admin" on public.chronicle_media
  for delete to authenticated using (
    private.is_lodge_member(chronicle_media.lodge_id)
    and (
      uploaded_by = (select auth.uid())
      or private.is_lodge_admin(chronicle_media.lodge_id)
      or exists (
        select 1 from public.chronicle_entries entry
        where entry.id = chronicle_media.chronicle_id
          and entry.lodge_id = chronicle_media.lodge_id
          and entry.author_id = (select auth.uid())
      )
    )
  );

drop policy "chronicle_media_objects_delete_uploader_or_admin" on storage.objects;
create policy "chronicle_media_objects_delete_uploader_or_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'chronicle-media'
    and exists (
      select 1 from public.chronicle_media media
      where media.storage_path = storage.objects.name
        and private.is_lodge_member(media.lodge_id)
        and (
          media.uploaded_by = (select auth.uid())
          or private.is_lodge_admin(media.lodge_id)
          or exists (
            select 1 from public.chronicle_entries entry
            where entry.id = media.chronicle_id
              and entry.lodge_id = media.lodge_id
              and entry.author_id = (select auth.uid())
          )
        )
    )
  );

drop policy "achievements_update_creator_or_admin" on public.achievements;
create policy "achievements_update_creator_or_admin" on public.achievements
  for update to authenticated
  using (
    source = 'manual' and private.is_lodge_member(lodge_id)
    and (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  )
  with check (source = 'manual' and private.is_lodge_member(lodge_id));

drop policy "achievements_delete_creator_or_admin" on public.achievements;
create policy "achievements_delete_creator_or_admin" on public.achievements
  for delete to authenticated using (
    source = 'manual' and private.is_lodge_member(lodge_id)
    and (created_by = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  );

drop policy "chronicle_delete_author_or_admin" on public.chronicle_entries;
create policy "chronicle_delete_author_or_admin" on public.chronicle_entries
  for delete to authenticated using (
    private.is_lodge_member(lodge_id)
    and (author_id = (select auth.uid()) or private.is_lodge_admin(lodge_id))
  );

create or replace function private.validate_achievement_boundary()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.lodge_id is distinct from old.lodge_id or new.created_by is distinct from old.created_by) then
    raise exception 'An achievement cannot be moved or reassigned.';
  end if;
  if new.character_id is not null and not exists (
    select 1 from public.characters character
    where character.id = new.character_id and character.profile_id = new.created_by
  ) then
    raise exception 'Only the creator''s Traveler may receive achievement credit.' using errcode = '23514';
  end if;
  if new.character_id is not null and not private.character_shared_with_lodge(new.character_id, new.lodge_id) then
    raise exception 'The character is not shared with this Lodge.';
  end if;
  return new;
end;
$$;

-- Preflight aggregate checks found no existing violations; validate each bound.
alter table public.chronicle_media
  add constraint chronicle_media_entry_path_check
    check (storage_path like lodge_id::text || '/' || chronicle_id::text || '/%') not valid;
alter table public.achievements
  add constraint achievements_content_check
    check (length(btrim(title)) between 1 and 120 and length(title) <= 120
      and (description is null or length(description) <= 2000)) not valid;
alter table public.chronicle_entries
  add constraint chronicle_content_check
    check (title is not null and length(btrim(title)) between 1 and 120 and length(title) <= 120
      and body is not null and length(btrim(body)) between 1 and 5000 and length(body) <= 5000) not valid;
alter table public.chronicle_media validate constraint chronicle_media_entry_path_check;
alter table public.achievements validate constraint achievements_content_check;
alter table public.chronicle_entries validate constraint chronicle_content_check;

-- Search before paging. SECURITY INVOKER keeps the existing table and character RLS.
create function public.search_lodge_achievement_ids(
  p_lodge_id uuid, p_query text, p_limit integer, p_offset integer
)
returns table(id uuid) language sql stable security invoker set search_path = '' as $$
  select achievement.id
  from public.achievements achievement
  left join public.characters character on character.id = achievement.character_id
  where achievement.lodge_id = p_lodge_id
    and (
      strpos(lower(achievement.title), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(achievement.description, '')), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(character.character_name, '')), lower(btrim(p_query))) > 0
    )
  order by achievement.achieved_at desc nulls last, achievement.created_at desc, achievement.id desc
  limit least(greatest(p_limit, 1), 101)
  offset greatest(p_offset, 0);
$$;
revoke all on function public.search_lodge_achievement_ids(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.search_lodge_achievement_ids(uuid, text, integer, integer)
  to authenticated;

create function public.search_lodge_chronicle_ids(
  p_lodge_id uuid, p_query text, p_from timestamptz, p_to timestamptz,
  p_limit integer, p_offset integer
)
returns table(id uuid) language sql stable security invoker set search_path = '' as $$
  select entry.id
  from public.chronicle_entries entry
  where entry.lodge_id = p_lodge_id
    and (p_from is null or entry.created_at >= p_from)
    and (p_to is null or entry.created_at <= p_to)
    and (
      strpos(lower(coalesce(entry.title, '')), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(entry.body, '')), lower(btrim(p_query))) > 0
    )
  order by entry.created_at desc, entry.id desc
  limit least(greatest(p_limit, 1), 101)
  offset greatest(p_offset, 0);
$$;
revoke all on function public.search_lodge_chronicle_ids(uuid, text, timestamptz, timestamptz, integer, integer)
  from public, anon;
grant execute on function public.search_lodge_chronicle_ids(uuid, text, timestamptz, timestamptz, integer, integer)
  to authenticated;
