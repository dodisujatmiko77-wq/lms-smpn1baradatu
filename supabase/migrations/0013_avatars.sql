-- =====================================================================
-- 0013 — Foto profil pengguna
--
-- Bucket privat `avatars`: setiap pengguna hanya bisa mengunggah, mengganti,
-- dan menghapus foto di foldernya sendiri (<id pengguna>/…). Foto dibuka lewat
-- signed URL oleh pemiliknya dan admin.
-- Kolom profiles.avatar_path sudah ada sejak 0002 (boleh diubah pemiliknya).
-- Migrasi ini aman dijalankan ulang dan tidak mengubah data.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (split_part(name, '/', 1) = (select auth.uid())::text or public.is_admin()));

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- avatar_path harus menunjuk ke folder milik pengguna itu sendiri.
-- NOT VALID: hanya memeriksa perubahan baru, data lama tidak disentuh.
alter table public.profiles drop constraint if exists profiles_avatar_path_own;
alter table public.profiles add constraint profiles_avatar_path_own
  check (avatar_path is null or (split_part(avatar_path, '/', 1) = id::text and avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'))
  not valid;
