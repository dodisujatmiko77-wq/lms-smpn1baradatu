-- Uji RLS & aturan data master Tahap 2. Jalankan setelah stub + migrasi pada database uji.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','admin2@lms.test','{"username":"admin2","full_name":"Admin"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000000b1','guru1@lms.test','{"username":"guru1","full_name":"Guru Matematika"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000000b2','guru2@lms.test','{"username":"guru2","full_name":"Guru B. Indonesia"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000000c1','1111111111@lms.test','{"username":"1111111111","full_name":"Siswa Satu"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000000c2','2222222222@lms.test','{"username":"2222222222","full_name":"Siswa Dua"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000000c3','3333333333@lms.test','{"username":"3333333333","full_name":"Siswa Tiga"}','{"roles":["student"]}');
insert into teachers (id, profile_id, nip, gender) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','198001012005011001','L'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b2',null,'P');
insert into students (id, profile_id, nisn, gender) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','1111111111','P'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c2','2222222222','L'),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c3','3333333333','L');

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

-- ===== Admin menyiapkan data =====
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('y1', admin_create_academic_year('2026/2027', '2026-07-13', '2027-06-30'));
select pg_temp.check((select count(*) from semesters where academic_year_id = (select v from ids where k='y1')) = 2, 'tahun pelajaran baru otomatis punya 2 semester');
insert into ids select 's1', id from semesters where academic_year_id = (select v from ids where k='y1') and number = 1;
insert into ids select 's2', id from semesters where academic_year_id = (select v from ids where k='y1') and number = 2;
select set_active_semester((select v from ids where k='s1'));
select pg_temp.check(active_semester_id() = (select v from ids where k='s1'), 'semester Ganjil aktif');
select pg_temp.check((select is_active from academic_years where id=(select v from ids where k='y1')), 'tahun pelajarannya ikut aktif');

insert into classes (id, academic_year_id, grade, name) values
 ('30000000-0000-0000-0000-00000000000a', (select v from ids where k='y1'), 7, 'VII-A'),
 ('30000000-0000-0000-0000-00000000000b', (select v from ids where k='y1'), 7, 'VII-B');
insert into subjects (id, code, name) values
 ('40000000-0000-0000-0000-000000000001','MTK','Matematika'),
 ('40000000-0000-0000-0000-000000000002','BIN','Bahasa Indonesia');
select pg_temp.check(enroll_students('30000000-0000-0000-0000-00000000000a', array['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002']::uuid[]) = 2, 'menempatkan 2 siswa ke VII-A');
select pg_temp.check(enroll_students('30000000-0000-0000-0000-00000000000b', array['20000000-0000-0000-0000-000000000003']::uuid[]) = 1, 'menempatkan 1 siswa ke VII-B');
select pg_temp.check((select academic_year_id from class_enrollments limit 1) = (select v from ids where k='y1'), 'tahun pelajaran penempatan terisi otomatis');
select pg_temp.check(enroll_students('30000000-0000-0000-0000-00000000000b', array['20000000-0000-0000-0000-000000000001']::uuid[]) = 1, 'memindahkan siswa ke kelas lain');
select pg_temp.check((select count(*) from class_enrollments where student_id='20000000-0000-0000-0000-000000000001') = 1, 'siswa hanya punya 1 kelas per tahun pelajaran');
select enroll_students('30000000-0000-0000-0000-00000000000a', array['20000000-0000-0000-0000-000000000001']::uuid[]);

insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id, hours_per_week) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-000000000001',(select v from ids where k='s1'), 5),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-00000000000b','40000000-0000-0000-0000-000000000002',(select v from ids where k='s1'), 6),
 ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-000000000002',(select v from ids where k='s1'), 6),
 ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-00000000000b','40000000-0000-0000-0000-000000000001',(select v from ids where k='s1'), 5);
select pg_temp.expect_error($$insert into teaching_assignments (teacher_id, class_id, subject_id, semester_id) values ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-000000000001',(select v from ids where k='s1'))$$, 'satu mapel di satu kelas hanya punya satu guru per semester');
insert into ids values ('y2', admin_create_academic_year('2027/2028', '2027-07-12', '2028-06-30'));
select pg_temp.expect_error($$insert into teaching_assignments (teacher_id, class_id, subject_id, semester_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-000000000002',(select id from semesters where academic_year_id=(select v from ids where k='y2') and number=1))$$, 'kelas & semester beda tahun pelajaran ditolak');

insert into class_guardians (class_id, teacher_id, semester_id) values ('30000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000002',(select v from ids where k='s1'));
select pg_temp.expect_error($$insert into class_guardians (class_id, teacher_id, semester_id) values ('30000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001',(select v from ids where k='s1'))$$, 'satu kelas hanya punya satu wali kelas per semester');

insert into schedules (teaching_assignment_id, day_of_week, start_time, end_time) values ('50000000-0000-0000-0000-000000000001', 1, '07:30', '08:50');
insert into schedules (teaching_assignment_id, day_of_week, start_time, end_time) values ('50000000-0000-0000-0000-000000000003', 1, '08:50', '10:10');
select pg_temp.expect_error($$insert into schedules (teaching_assignment_id, day_of_week, start_time, end_time) values ('50000000-0000-0000-0000-000000000003', 1, '08:00', '09:00')$$, 'jadwal bentrok di kelas yang sama ditolak');
select pg_temp.expect_error($$insert into schedules (teaching_assignment_id, day_of_week, start_time, end_time) values ('50000000-0000-0000-0000-000000000004', 1, '08:00', '09:00')$$, 'guru mengajar dua kelas di jam yang sama ditolak');
select pg_temp.expect_error($$insert into schedules (teaching_assignment_id, day_of_week, start_time, end_time) values ('50000000-0000-0000-0000-000000000004', 1, '10:00', '09:00')$$, 'jam selesai sebelum jam mulai ditolak');
insert into schedules (teaching_assignment_id, day_of_week, start_time, end_time) values ('50000000-0000-0000-0000-000000000004', 1, '08:50', '10:10');
select pg_temp.check(true, 'jadwal bersebelahan (tidak beririsan) diterima');

select pg_temp.check(copy_teaching_assignments((select v from ids where k='s1'), (select v from ids where k='s2')) = 4, 'menyalin 4 penugasan Ganjil → Genap');
select pg_temp.check(copy_teaching_assignments((select v from ids where k='s1'), (select v from ids where k='s2')) = 0, 'menyalin ulang tidak menggandakan');
select admin_update_student('20000000-0000-0000-0000-000000000002', '{"full_name":"Siswa Dua Baru","nis":"2026002","status":"active"}');
select pg_temp.check((select full_name from v_students where id='20000000-0000-0000-0000-000000000002') = 'Siswa Dua Baru' and (select nis from students where id='20000000-0000-0000-0000-000000000002') = '2026002', 'admin mengubah data siswa + nama profil sekaligus');
select pg_temp.check((admin_school_stats()->>'classes')::int = 2 and (admin_school_stats()->>'unplaced_students')::int = 0 and (admin_school_stats()->>'classes_without_guardian')::int = 1, 'statistik sekolah admin');
select pg_temp.check((select count(*) from v_teachers where assignment_count = 2) = 2, 'v_teachers menghitung penugasan semester aktif');
select pg_temp.check((select count(*) from audit_logs where entity = 'teaching_assignments') >= 4, 'perubahan penugasan tercatat di audit log');
reset role;

-- ===== Guru 1 (mengajar MTK di VII-A dan VII-B) =====
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) from students) = 3, 'guru melihat siswa di kelas yang ia ajar');
select pg_temp.check((select count(*) from v_students) = 3, 'v_students mengikuti RLS guru');
select pg_temp.check((select count(*) from teachers) = 1, 'guru hanya melihat data guru miliknya');
select pg_temp.check((select count(*) from teaching_assignments) = 4, 'guru melihat penugasannya (2 semester)');
select pg_temp.check((select count(*) from get_my_teaching()) = 2, 'get_my_teaching: 2 kelas semester aktif');
select pg_temp.check((select student_count from get_my_teaching() where class_name='VII-A') = 2, 'jumlah siswa per kelas benar');
select pg_temp.check((select count(*) from get_my_schedule()) = 2, 'jadwal mengajar guru');
select pg_temp.check((get_my_context()->>'teacher_id') = '10000000-0000-0000-0000-000000000001', 'konteks guru berisi teacher_id');
select pg_temp.check(jsonb_array_length(get_my_context()->'guardian_class_ids') = 0, 'guru 1 bukan wali kelas');
select pg_temp.check((select count(*) from profiles where username in ('1111111111','2222222222')) = 2, 'guru membaca profil siswanya');
select pg_temp.check((select count(*) from audit_logs) = 0, 'guru tidak membaca audit log');
update classes set name = 'DIRETAS' where id = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check((select name from classes where id='30000000-0000-0000-0000-00000000000a') = 'VII-A', 'guru tidak bisa mengubah kelas');
select pg_temp.check((select count(*) from schedules) = 2, 'guru hanya melihat jadwal mapel yang ia ajar');
delete from schedules;
reset role;
select pg_temp.check((select count(*) from schedules) = 3, 'guru tidak bisa menghapus jadwal');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($$select enroll_students('30000000-0000-0000-0000-00000000000a', array['20000000-0000-0000-0000-000000000003']::uuid[])$$, 'guru tidak bisa menempatkan siswa');
select pg_temp.expect_error($$select set_active_semester((select id from semesters where number = 2 limit 1))$$, 'guru tidak bisa mengubah semester aktif');
reset role;

-- ===== Guru 2 (wali kelas VII-A, mengajar BIN di VII-A & VII-B) =====
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select pg_temp.check(jsonb_array_length(get_my_context()->'guardian_class_ids') = 1, 'guru 2 terdeteksi sebagai wali kelas');
select pg_temp.check((select count(*) from class_guardians) = 1, 'wali kelas melihat penugasan walinya');
reset role;

-- Guru tanpa kelas tidak melihat siswa
delete from teaching_assignments where teacher_id = '10000000-0000-0000-0000-000000000001' and class_id = '30000000-0000-0000-0000-00000000000b';
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) from students) = 2, 'setelah penugasan VII-B dihapus, guru tidak lagi melihat siswa VII-B');
reset role;

-- ===== Siswa 1 (VII-A) =====
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from students) = 1, 'siswa hanya melihat data dirinya');
select pg_temp.check((select count(*) from v_students) = 1, 'v_students hanya baris dirinya');
select pg_temp.check((select count(*) from class_enrollments) = 1, 'siswa hanya melihat penempatannya');
select pg_temp.check((select count(*) from teaching_assignments where semester_id = active_semester_id()) = 2, 'siswa melihat mapel kelasnya');
select pg_temp.check((select count(*) from teaching_assignments where class_id = '30000000-0000-0000-0000-00000000000b') = 0, 'siswa tidak melihat mapel kelas lain');
select pg_temp.check((select count(*) from get_my_schedule()) = 2, 'jadwal siswa VII-A');
select pg_temp.check((select count(*) from get_my_schedule() where class_name <> 'VII-A') = 0, 'jadwal siswa hanya kelasnya');
select pg_temp.check((select count(*) from profiles) = 1, 'siswa tidak membaca profil siswa/guru lain');
select pg_temp.check((select count(*) from teachers) = 0, 'siswa tidak membaca data guru (NIP)');
select pg_temp.check((get_my_context()->'student_class'->>'name') = 'VII-A', 'konteks siswa berisi kelasnya');
select pg_temp.check((get_my_context()->'active_semester'->>'academic_year') = '2026/2027', 'konteks berisi semester aktif');
insert into class_enrollments (class_id, student_id, academic_year_id) select '30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', academic_year_id from classes limit 0;
select pg_temp.expect_error($$insert into class_enrollments (class_id, student_id, academic_year_id) values ('30000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000002', active_academic_year_id())$$, 'siswa tidak bisa menempatkan siswa');
select pg_temp.expect_error($$select admin_school_stats()$$, 'siswa ditolak membaca statistik sekolah');
reset role;

-- ===== Siswa 3 (VII-B) =====
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select pg_temp.check((select count(*) from get_my_schedule()) = 0, 'siswa VII-B tidak melihat jadwal VII-A');
reset role;

set local role anon;
select pg_temp.expect_error($$select * from classes$$, 'anon tidak bisa membaca data akademik');
reset role;
rollback;
