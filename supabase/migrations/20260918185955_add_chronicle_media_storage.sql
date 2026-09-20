-- Private Chronicle screenshots, captions, and Lodge-scoped Storage access.
create table public.chronicle_media (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicle_entries(id) on delete cascade,
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  caption text,
  created_at timestamptz not null default now(),
  check (storage_path like lodge_id::text || '/%'),
  check (char_length(caption) <= 500)
);

create index idx_chronicle_media_chronicle on public.chronicle_media(chronicle_id, created_at);
alter table public.chronicle_media enable row level security;

create policy "chronicle_media_select_member" on public.chronicle_media
  for select using (private.is_lodge_member(lodge_id));
create policy "chronicle_media_insert_author_or_admin" on public.chronicle_media
  for insert with check (
    uploaded_by = (select auth.uid()) and private.is_lodge_member(lodge_id)
    and exists (select 1 from public.chronicle_entries entry where entry.id = chronicle_id
      and entry.lodge_id = lodge_id and (entry.author_id = (select auth.uid())
        or private.is_lodge_admin(lodge_id)))
  );
create policy "chronicle_media_delete_uploader_or_admin" on public.chronicle_media
  for delete using (
    uploaded_by = (select auth.uid())
    or private.is_lodge_admin(lodge_id)
    or exists (
      select 1 from public.chronicle_entries entry
      where entry.id = chronicle_id and entry.author_id = (select auth.uid())
    )
  );

-- Return null for malformed object names, rather than casting untrusted paths.
create function private.storage_path_uuid_segment(p_path text, p_segment integer)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(p_path, '/', p_segment) ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(p_path, '/', p_segment)::uuid else null end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chronicle-media', 'chronicle-media', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "chronicle_media_objects_select_member" on storage.objects
  for select to authenticated using (
    bucket_id = 'chronicle-media'
    and private.is_lodge_member(private.storage_path_uuid_segment(name, 1))
  );
create policy "chronicle_media_objects_insert_author_or_admin" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chronicle-media' and owner_id = (select auth.uid()::text)
    and exists (select 1 from public.chronicle_entries entry
      where entry.id = private.storage_path_uuid_segment(name, 2)
        and entry.lodge_id = private.storage_path_uuid_segment(name, 1)
        and (entry.author_id = (select auth.uid()) or private.is_lodge_admin(entry.lodge_id)))
  );
create policy "chronicle_media_objects_delete_uploader_or_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'chronicle-media' and exists (select 1 from public.chronicle_media media
      where media.storage_path = name and (media.uploaded_by = (select auth.uid())
        or private.is_lodge_admin(media.lodge_id) or exists (
          select 1 from public.chronicle_entries entry
          where entry.id = media.chronicle_id and entry.author_id = (select auth.uid())
        )))
  );
