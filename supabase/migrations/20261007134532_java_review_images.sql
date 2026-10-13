-- Private images are isolated by the account UUID in the first path segment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jrs-note-images', 'jrs-note-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy jrs_images_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'jrs-note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy jrs_images_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'jrs-note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy jrs_images_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'jrs-note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
