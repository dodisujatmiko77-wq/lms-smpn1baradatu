-- =====================================================================
-- 0001 — Ekstensi, tipe enum, dan fungsi utilitas umum
-- Tahap 1 (Fondasi)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Role utama aplikasi. Wali kelas BUKAN role, melainkan penugasan
-- (tabel class_guardians, Tahap 2) pada akun guru.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'teacher', 'student');
  end if;
end$$;

-- Trigger umum untuk memperbarui kolom updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
