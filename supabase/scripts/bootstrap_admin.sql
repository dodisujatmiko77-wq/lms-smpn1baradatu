-- =====================================================================
-- Membuat administrator PERTAMA (dijalankan sekali di SQL Editor Supabase)
--
-- Langkah:
--  1. Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
--     Email : admin@lms.smpn1baradatu.sch.id   (format <username>@<LOGIN_EMAIL_DOMAIN>)
--     Password kuat, centang "Auto Confirm User".
--     Dengan format ini admin bisa login cukup dengan username "admin".
--     (Boleh juga memakai email asli; login kemudian harus memakai email tersebut.)
--  2. Sesuaikan nilai di bawah, lalu jalankan skrip ini di SQL Editor.
--  3. Login di aplikasi menggunakan username (atau email) dan password tersebut.
-- Akun berikutnya (guru/siswa/admin lain) dibuat dari menu Admin → Akun Pengguna.
-- =====================================================================
do $$
declare
  v_email     text := 'admin@lms.smpn1baradatu.sch.id';   -- email yang dibuat pada langkah 1
  v_username  text := 'admin';                 -- username untuk login
  v_full_name text := 'Administrator LMS';
  v_id uuid;
begin
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    raise exception 'Akun dengan email % belum ada di Authentication', v_email;
  end if;

  update public.profiles
     set username = lower(v_username), full_name = v_full_name, is_active = true
   where id = v_id;

  insert into public.user_roles (user_id, role) values (v_id, 'admin') on conflict do nothing;
  raise notice 'Admin pertama siap: % (%)', v_username, v_email;
end $$;
