-- Uji pembersihan berkas jawaban semester lalu (Tahap 8).
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000008a1','adm8@lms.test','{"username":"adm8","full_name":"Admin Delapan"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000008b1','gr81@lms.test','{"username":"gr81","full_name":"Guru"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000008c1','8800000001@lms.test','{"username":"8800000001","full_name":"Siswa"}','{"roles":["student"]}');
insert into teachers (id, profile_id) values ('18000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000008b1');
insert into students (id, profile_id, nisn, gender) values ('28000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000008c1','8800000001','P');
create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
-- Tahun lalu (selesai) & tahun aktif
select admin_create_academic_year('2001/2002','2001-07-15','2002-06-30');
select admin_create_academic_year('2080/2081','2080-07-15','2081-06-30');
select set_active_semester((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2080/2081' and s.number = 1));
insert into classes (id, academic_year_id, grade, name) values
 ('38000000-0000-0000-0000-00000000000a', (select id from academic_years where name = '2001/2002'), 7, 'LAMA'),
 ('38000000-0000-0000-0000-00000000000b', active_academic_year_id(), 7, 'BARU');
insert into subjects (id, code, name) values ('48000000-0000-0000-0000-000000000001','SEN8','Seni');
insert into class_enrollments (class_id, student_id, academic_year_id) values
 ('38000000-0000-0000-0000-00000000000a','28000000-0000-0000-0000-000000000001',(select id from academic_years where name = '2001/2002'));
insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id) values
 ('58000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-00000000000a','48000000-0000-0000-0000-000000000001',
  (select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2001/2002' and s.number = 1));
reset role;
insert into assignments (id, teaching_assignment_id, title, submission_types, start_at, due_at, status, description)
values ('68000000-0000-0000-0000-000000000001','58000000-0000-0000-0000-000000000001','Tugas lama', array['file'], '2001-08-01', '2001-08-10', 'published', 'x');
insert into assignment_submissions (assignment_id, student_id, teaching_assignment_id, status, text_answer, submitted_at, files)
values ('68000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','58000000-0000-0000-0000-000000000001','submitted','Teks tetap', '2001-08-05',
 '[{"storage_path":"58000000-0000-0000-0000-000000000001/68000000-0000-0000-0000-000000000001/siswa/28000000-0000-0000-0000-000000000001/a.pdf","size_bytes":1000},{"storage_path":"58000000-0000-0000-0000-000000000001/68000000-0000-0000-0000-000000000001/siswa/28000000-0000-0000-0000-000000000001/b.jpg","size_bytes":500}]');
insert into assignment_grades (assignment_id, student_id, score, published_at) values ('68000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001', 80, '2001-08-12');

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select pg_temp.check((select files = 2 and total_bytes = 1500 and ended from admin_submission_files_by_semester() where label = '2001/2002 Ganjil'), 'ringkasan: 2 berkas (1,5 KB) di semester lalu');
select pg_temp.check(cardinality(admin_submission_file_paths((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2001/2002' and s.number = 1))) = 2, 'daftar path berkas untuk dihapus');
select pg_temp.expect_error($$select admin_submission_file_paths(active_semester_id())$$, 'semester aktif tidak bisa dibersihkan');
select pg_temp.check(admin_mark_submission_files_purged((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2001/2002' and s.number = 1), 2, 1500) = 1, 'pengumpulan ditandai sudah dibersihkan');
reset role;
select pg_temp.check((select files = '[]'::jsonb and files_purged_at is not null and text_answer = 'Teks tetap' from assignment_submissions where assignment_id = '68000000-0000-0000-0000-000000000001'), 'jawaban teks tetap ada, daftar berkas kosong');
select pg_temp.check((select score from assignment_grades where assignment_id = '68000000-0000-0000-0000-000000000001') = 80, 'nilai tidak terhapus');
select pg_temp.check(exists (select 1 from audit_logs where action = 'storage.purge_submissions'), 'pembersihan tercatat di audit log');
select pg_temp.login('00000000-0000-0000-0000-0000000008b1');
select pg_temp.expect_error($$select * from admin_submission_files_by_semester()$$, 'guru tidak bisa membuka fitur pembersihan');
reset role;
rollback;
