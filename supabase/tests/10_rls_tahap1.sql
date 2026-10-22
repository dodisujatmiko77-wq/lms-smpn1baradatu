-- Uji RLS Tahap 1. Jalankan setelah stub + migrasi pada database uji.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@lms.test','{"username":"admin","full_name":"Admin Sekolah"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-00000000000b','198001012005011001@lms.test','{"username":"198001012005011001","full_name":"Budi Guru"}','{"roles":["teacher"],"must_change_password":true}'),
 ('00000000-0000-0000-0000-00000000000c','0123456789@lms.test','{"username":"0123456789","full_name":"Siti Siswa"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-00000000000d','0987654321@lms.test','{"username":"0987654321","full_name":"Andi Siswa"}','{"roles":["student"]}');

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;

-- Trigger profil & role
select pg_temp.check((select count(*) from profiles) = 4, 'trigger membuat 4 profil');
select pg_temp.check((select must_change_password from profiles where username='198001012005011001'), 'flag wajib ganti password terbawa');

-- Siswa
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from profiles) = 1, 'siswa hanya melihat profil sendiri');
select pg_temp.check((select count(*) from user_roles) = 1, 'siswa hanya melihat role sendiri');
select pg_temp.check(not is_admin(), 'siswa bukan admin');
select pg_temp.check((get_my_context()->>'full_name') = 'Siti Siswa', 'get_my_context mengembalikan profil sendiri');
select pg_temp.check((select count(*) from audit_logs) = 0, 'siswa tidak bisa membaca audit log');
update profiles set phone = '0812' where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select phone from profiles) = '0812', 'siswa bisa mengubah no. HP sendiri');
update profiles set phone = 'x' where id = '00000000-0000-0000-0000-00000000000d';
reset role;
select pg_temp.check((select phone from profiles where id='00000000-0000-0000-0000-00000000000d') is null, 'siswa tidak bisa mengubah profil siswa lain');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin update profiles set is_active = true where id = auth.uid(); raise exception 'GAGAL: siswa bisa ubah is_active';
  exception when insufficient_privilege then raise notice 'OK: siswa tidak bisa mengubah is_active'; end;
  begin insert into user_roles(user_id, role) values (auth.uid(), 'admin'); raise exception 'GAGAL: siswa bisa menambah role';
  exception when insufficient_privilege then raise notice 'OK: siswa tidak bisa menambah role sendiri'; end;
  begin perform admin_account_stats(); raise exception 'GAGAL: siswa bisa membaca statistik admin';
  exception when insufficient_privilege then raise notice 'OK: statistik admin ditolak untuk siswa'; end;
  begin perform admin_update_profile(auth.uid(), 'Hacker'); raise exception 'GAGAL';
  exception when insufficient_privilege then raise notice 'OK: admin_update_profile ditolak untuk siswa'; end;
end $$;
update school_settings set school_name = 'X';
select pg_temp.check((select school_name from school_settings) <> 'X', 'siswa tidak bisa mengubah pengaturan sekolah');
reset role;

-- Anon (halaman login)
set local role anon;
select pg_temp.check((select count(*) from school_settings) = 1, 'anon bisa membaca pengaturan sekolah');
do $$ begin
  begin perform 1 from profiles; raise exception 'GAGAL: anon bisa baca profil';
  exception when insufficient_privilege then raise notice 'OK: anon tidak bisa membaca profil'; end;
end $$;
reset role;

-- Admin
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from profiles) = 4, 'admin melihat semua profil');
select pg_temp.check((admin_account_stats()->>'students')::int = 2, 'statistik admin: 2 siswa');
update school_settings set tagline = 'Uji';
select pg_temp.check((select tagline from school_settings) = 'Uji', 'admin bisa mengubah pengaturan');
select admin_update_profile('00000000-0000-0000-0000-00000000000d', 'Andi Pratama');
select pg_temp.check((select full_name from profiles where id='00000000-0000-0000-0000-00000000000d') = 'Andi Pratama', 'admin bisa mengubah nama siswa');
select pg_temp.check((select count(*) from audit_logs where actor_id is not null and action in ('school_settings.update','user.update_profile')) = 2, 'perubahan tercatat di audit log');

-- Akun nonaktif kehilangan hak admin
reset role;
update profiles set is_active = false where username = 'admin';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(not is_admin(), 'admin nonaktif tidak lagi dianggap admin');
select pg_temp.check((select count(*) from profiles) = 1, 'admin nonaktif hanya melihat profil sendiri');
reset role;
rollback;
