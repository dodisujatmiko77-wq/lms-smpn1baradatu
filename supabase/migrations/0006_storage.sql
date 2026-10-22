-- =====================================================================
-- 0006 — Supabase Storage: bucket & kebijakan akses berkas
-- Tahap 3 (Pembelajaran)
--
-- public-assets : logo sekolah (publik, hanya admin yang mengunggah)
-- materials     : berkas materi (PRIVAT, dibaca lewat signed URL)
--                 path: {teaching_assignment_id}/{lesson_id}/{nama-berkas}
--
-- Batas ukuran per berkas di bucket adalah batas KERAS. Batas yang lebih kecil
-- (Pengaturan Sekolah → Unggahan file) diterapkan oleh aplikasi.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-assets', 'public-assets', true, 2097152,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('materials', 'materials', false, 52428800,
   array[
     'application/pdf',
     'image/png', 'image/jpeg', 'image/webp', 'image/gif',
     'application/vnd.ms-powerpoint',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/vnd.oasis.opendocument.text',
     'application/vnd.oasis.opendocument.presentation',
     'application/vnd.oasis.opendocument.spreadsheet'
   ])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- uuid dari teks; null bila format salah (agar policy tidak error pada path aneh).
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Boleh membaca berkas materi: pengelola ruang kelas, atau anggota kelas bila pertemuannya sudah dipublikasikan.
create or replace function public.can_read_material_object(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.can_manage_ta(public.try_uuid(split_part(p_name, '/', 1)))
      or (
        public.can_view_ta(public.try_uuid(split_part(p_name, '/', 1)))
        and exists (
          select 1 from public.lessons l
          where l.id = public.try_uuid(split_part(p_name, '/', 2))
            and l.teaching_assignment_id = public.try_uuid(split_part(p_name, '/', 1))
            and l.status = 'published'
        )
      )
$$;

-- Boleh menulis berkas materi: hanya pengelola ruang kelas & pertemuan harus milik ruang kelas tsb.
create or replace function public.can_write_material_object(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.can_manage_ta(public.try_uuid(split_part(p_name, '/', 1)))
     and exists (
       select 1 from public.lessons l
       where l.id = public.try_uuid(split_part(p_name, '/', 2))
         and l.teaching_assignment_id = public.try_uuid(split_part(p_name, '/', 1))
     )
$$;

revoke execute on function public.can_read_material_object(text) from public, anon;
revoke execute on function public.can_write_material_object(text) from public, anon;
grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.can_read_material_object(text) to authenticated;
grant execute on function public.can_write_material_object(text) to authenticated;

-- ---------------------------------------------------------------------
-- Kebijakan storage.objects
-- ---------------------------------------------------------------------
drop policy if exists "public_assets_admin_insert" on storage.objects;
create policy "public_assets_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_admin());

drop policy if exists "public_assets_admin_update" on storage.objects;
create policy "public_assets_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

drop policy if exists "public_assets_admin_delete" on storage.objects;
create policy "public_assets_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());

drop policy if exists "public_assets_admin_select" on storage.objects;
create policy "public_assets_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());

drop policy if exists "materials_select" on storage.objects;
create policy "materials_select" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and public.can_read_material_object(name));

drop policy if exists "materials_insert" on storage.objects;
create policy "materials_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.can_write_material_object(name));

drop policy if exists "materials_update" on storage.objects;
create policy "materials_update" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.can_write_material_object(name))
  with check (bucket_id = 'materials' and public.can_write_material_object(name));

drop policy if exists "materials_delete" on storage.objects;
create policy "materials_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.can_write_material_object(name));
