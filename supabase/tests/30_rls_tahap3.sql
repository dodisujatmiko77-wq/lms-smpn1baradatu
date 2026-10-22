-- Uji RLS & aturan ruang kelas digital Tahap 3. Jalankan setelah stub + migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000003a1','adm3@lms.test','{"username":"adm3","full_name":"Admin"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000003b1','gr31@lms.test','{"username":"gr31","full_name":"Guru MTK"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000003b2','gr32@lms.test','{"username":"gr32","full_name":"Guru BIN Wali"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000003c1','4444444444@lms.test','{"username":"4444444444","full_name":"Siswa A"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000003c2','5555555555@lms.test','{"username":"5555555555","full_name":"Siswa B (kelas lain)"}','{"roles":["student"]}');
insert into teachers (id, profile_id) values
 ('13000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000003b1'),
 ('13000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000003b2');
insert into students (id, profile_id, nisn, gender) values
 ('23000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000003c1','4444444444','P'),
 ('23000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000003c2','5555555555','L');

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

-- Data akademik dasar (sebagai admin)
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
select admin_create_academic_year('2030/2031','2030-07-15','2031-06-30');
select set_active_semester((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2030/2031' and s.number = 1));
insert into classes (id, academic_year_id, grade, name) values
 ('33000000-0000-0000-0000-00000000000a', active_academic_year_id(), 8, 'VIII-A'),
 ('33000000-0000-0000-0000-00000000000b', active_academic_year_id(), 8, 'VIII-B');
insert into subjects (id, code, name) values ('43000000-0000-0000-0000-000000000001','MTK3','Matematika'), ('43000000-0000-0000-0000-000000000002','BIN3','B. Indonesia');
select enroll_students('33000000-0000-0000-0000-00000000000a', array['23000000-0000-0000-0000-000000000001']::uuid[]);
select enroll_students('33000000-0000-0000-0000-00000000000b', array['23000000-0000-0000-0000-000000000002']::uuid[]);
insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id) values
 ('53000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-00000000000a','43000000-0000-0000-0000-000000000001', active_semester_id()),
 ('53000000-0000-0000-0000-000000000002','13000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-00000000000a','43000000-0000-0000-0000-000000000002', active_semester_id()),
 ('53000000-0000-0000-0000-000000000003','13000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-00000000000b','43000000-0000-0000-0000-000000000001', active_semester_id());
insert into class_guardians (class_id, teacher_id, semester_id) values ('33000000-0000-0000-0000-00000000000a','13000000-0000-0000-0000-000000000002', active_semester_id());
reset role;

-- ===== Guru MTK menyusun ruang kelas VIII-A =====
select pg_temp.login('00000000-0000-0000-0000-0000000003b1');
insert into course_sections (id, teaching_assignment_id, title, position) values ('63000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','Bab 1: Bilangan', 1);
insert into lessons (id, teaching_assignment_id, section_id, meeting_number, title, content_html, status) values
 ('73000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001',1,'Bilangan Bulat','<p>Isi</p>','published'),
 ('73000000-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001',2,'Operasi Bilangan','<p>Draf</p>','draft');
select pg_temp.check((select published_at is not null from lessons where id='73000000-0000-0000-0000-000000000001'), 'published_at terisi saat pertemuan dipublikasikan');
select pg_temp.check((select created_by from lessons where id='73000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000003b1', 'created_by terisi otomatis');
insert into lesson_materials (lesson_id, type, title, url) values ('73000000-0000-0000-0000-000000000001','video','Video penjelasan','https://www.youtube.com/watch?v=abc');
insert into lesson_materials (lesson_id, type, title, storage_path, size_bytes) values ('73000000-0000-0000-0000-000000000001','pdf','Modul','53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000001/modul.pdf', 1024);
insert into lesson_materials (lesson_id, type, title, storage_path) values ('73000000-0000-0000-0000-000000000002','pdf','Modul draf','53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000002/draf.pdf');
select pg_temp.check((select teaching_assignment_id from lesson_materials limit 1) = '53000000-0000-0000-0000-000000000001', 'teaching_assignment_id materi terisi dari pertemuan');
select pg_temp.expect_error($$insert into lesson_materials (lesson_id, type, title) values ('73000000-0000-0000-0000-000000000001','link','Tanpa URL')$$, 'tautan tanpa URL ditolak');
select pg_temp.expect_error($$insert into lesson_materials (lesson_id, type, title, url) values ('73000000-0000-0000-0000-000000000001','link','JS','javascript:alert(1)')$$, 'URL non-http (javascript:) ditolak');
select pg_temp.expect_error($$insert into lessons (teaching_assignment_id, title) values ('53000000-0000-0000-0000-000000000002','Menyusup ke kelas BIN')$$, 'guru tidak bisa menambah pertemuan di ruang kelas guru lain');
select pg_temp.expect_error($$insert into lessons (teaching_assignment_id, section_id, title) values ('53000000-0000-0000-0000-000000000003','63000000-0000-0000-0000-000000000001','Bab beda kelas')$$, 'bab dari ruang kelas lain ditolak');
select pg_temp.check(can_write_material_object('53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000001/a.pdf'), 'guru boleh mengunggah berkas ke pertemuannya');
select pg_temp.check(not can_write_material_object('53000000-0000-0000-0000-000000000002/73000000-0000-0000-0000-000000000001/a.pdf'), 'guru tidak boleh mengunggah ke ruang kelas guru lain');
select pg_temp.check(not can_write_material_object('../../etc/passwd'), 'path berkas aneh ditolak tanpa error');
select pg_temp.check((get_course('53000000-0000-0000-0000-000000000001')->>'can_manage')::boolean, 'get_course: guru pengampu dapat mengelola');
reset role;

-- Guru BIN (wali kelas VIII-A) tidak boleh mengubah konten MTK
select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select pg_temp.check((select count(*) from lessons where teaching_assignment_id='53000000-0000-0000-0000-000000000001') = 1, 'wali kelas hanya melihat pertemuan MTK yang dipublikasikan');
update lessons set title = 'Diubah wali' where id = '73000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.check((select title from lessons where id='73000000-0000-0000-0000-000000000001') = 'Bilangan Bulat', 'wali kelas tidak bisa mengubah materi guru lain');
select pg_temp.login('00000000-0000-0000-0000-0000000003b2');
select pg_temp.check(not (get_course('53000000-0000-0000-0000-000000000001')->>'can_manage')::boolean, 'get_course: wali kelas tidak dapat mengelola');
select pg_temp.check((select count(*) from get_course_progress('53000000-0000-0000-0000-000000000001')) = 1, 'wali kelas dapat memantau progress kelas binaan');
reset role;

-- ===== Siswa A (VIII-A) =====
select pg_temp.login('00000000-0000-0000-0000-0000000003c1');
select pg_temp.check((select count(*) from lessons) = 1, 'siswa hanya melihat pertemuan yang dipublikasikan');
select pg_temp.check((select count(*) from lesson_materials) = 2, 'siswa melihat materi pertemuan terbit, bukan materi draf');
select pg_temp.check(can_read_material_object('53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000001/modul.pdf'), 'siswa boleh membaca berkas pertemuan terbit');
select pg_temp.check(not can_read_material_object('53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000002/draf.pdf'), 'siswa tidak boleh membaca berkas pertemuan draf');
select pg_temp.check(not can_write_material_object('53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000001/x.pdf'), 'siswa tidak boleh mengunggah berkas materi');
select pg_temp.check((select count(*) from get_my_courses()) = 2, 'siswa melihat 2 mapel kelasnya');
select pg_temp.check((select lesson_count from get_my_courses() where subject_name='Matematika') = 1, 'jumlah pertemuan terbit dihitung');
select pg_temp.check((mark_lesson_progress('73000000-0000-0000-0000-000000000001','open')->>'status') = 'in_progress', 'membuka pertemuan → sedang dipelajari');
select pg_temp.check((mark_lesson_progress('73000000-0000-0000-0000-000000000001','complete')->>'status') = 'completed', 'tandai selesai → selesai');
select pg_temp.check((mark_lesson_progress('73000000-0000-0000-0000-000000000001','open')->>'status') = 'completed', 'membuka lagi tidak menurunkan status selesai');
select pg_temp.check((select view_count from lesson_progress) = 2, 'jumlah kunjungan tercatat');
select pg_temp.check((select completed_count from get_my_courses() where subject_name='Matematika') = 1, 'progress mapel: 1/1 selesai');
select pg_temp.expect_error($$select mark_lesson_progress('73000000-0000-0000-0000-000000000002','complete')$$, 'siswa tidak bisa menandai pertemuan draf');
select pg_temp.expect_error($$insert into lesson_progress (lesson_id, student_id, teaching_assignment_id) values ('73000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000001')$$, 'siswa tidak bisa menulis progress langsung (hanya lewat RPC)');
select pg_temp.expect_error($$select * from get_course_progress('53000000-0000-0000-0000-000000000001')$$, 'siswa tidak bisa melihat progress teman sekelas');
update lessons set status = 'draft';
reset role;
select pg_temp.check((select status from lessons where id='73000000-0000-0000-0000-000000000001') = 'published', 'siswa tidak bisa mengubah status pertemuan');

-- ===== Siswa B (VIII-B) =====
select pg_temp.login('00000000-0000-0000-0000-0000000003c2');
select pg_temp.check((select count(*) from lessons where teaching_assignment_id='53000000-0000-0000-0000-000000000001') = 0, 'siswa kelas lain tidak melihat pertemuan VIII-A');
select pg_temp.check(not can_read_material_object('53000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000001/modul.pdf'), 'siswa kelas lain tidak boleh membaca berkas VIII-A');
select pg_temp.check(get_course('53000000-0000-0000-0000-000000000001') is null, 'get_course kelas lain tidak mengembalikan apa pun');
select pg_temp.expect_error($$select mark_lesson_progress('73000000-0000-0000-0000-000000000001','complete')$$, 'siswa kelas lain tidak bisa mencatat progress');
reset role;

-- ===== Guru MTK memantau & unpublish =====
select pg_temp.login('00000000-0000-0000-0000-0000000003b1');
select pg_temp.check((select completed from get_course_progress('53000000-0000-0000-0000-000000000001') where nisn='4444444444') = 1, 'guru melihat progress siswa: 1 selesai');
select pg_temp.check((select completed from get_lesson_stats('53000000-0000-0000-0000-000000000001') where lesson_id='73000000-0000-0000-0000-000000000001') = 1, 'statistik pertemuan: 1 siswa selesai');
update lessons set status = 'draft' where id = '73000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.check((select count(*) from audit_logs where action in ('lessons.unpublish')) = 1, 'penarikan publikasi tercatat di audit log');
select pg_temp.login('00000000-0000-0000-0000-0000000003c1');
select pg_temp.check((select count(*) from lessons) = 0, 'setelah ditarik ke draf, siswa tidak lagi melihat pertemuan');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
select pg_temp.check((admin_storage_usage()->>'total_bytes')::int = 1024, 'admin melihat total penggunaan penyimpanan');
reset role;
rollback;
