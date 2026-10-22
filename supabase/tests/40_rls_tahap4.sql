-- Uji RLS & aturan tugas Tahap 4. Jalankan setelah stub + migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000004a1','adm4@lms.test','{"username":"adm4","full_name":"Admin"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000004b1','gr41@lms.test','{"username":"gr41","full_name":"Guru IPA"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000004b2','gr42@lms.test','{"username":"gr42","full_name":"Guru Wali"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000004c1','6666666666@lms.test','{"username":"6666666666","full_name":"Siswa A"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000004c2','7777777777@lms.test','{"username":"7777777777","full_name":"Siswa B"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000004c3','8888888888@lms.test','{"username":"8888888888","full_name":"Siswa Lain"}','{"roles":["student"]}');
insert into teachers (id, profile_id) values
 ('14000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000004b1'),
 ('14000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000004b2');
insert into students (id, profile_id, nisn, gender) values
 ('24000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000004c1','6666666666','P'),
 ('24000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000004c2','7777777777','L'),
 ('24000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000004c3','8888888888','L');

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select admin_create_academic_year('2040/2041','2040-07-15','2041-06-30');
select set_active_semester((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2040/2041' and s.number = 1));
insert into classes (id, academic_year_id, grade, name) values
 ('34000000-0000-0000-0000-00000000000a', active_academic_year_id(), 7, 'VII-X'),
 ('34000000-0000-0000-0000-00000000000b', active_academic_year_id(), 7, 'VII-Y');
insert into subjects (id, code, name) values ('44000000-0000-0000-0000-000000000001','IPA4','IPA');
select enroll_students('34000000-0000-0000-0000-00000000000a', array['24000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002']::uuid[]);
select enroll_students('34000000-0000-0000-0000-00000000000b', array['24000000-0000-0000-0000-000000000003']::uuid[]);
insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id) values
 ('54000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','34000000-0000-0000-0000-00000000000a','44000000-0000-0000-0000-000000000001', active_semester_id()),
 ('54000000-0000-0000-0000-000000000002','14000000-0000-0000-0000-000000000001','34000000-0000-0000-0000-00000000000b','44000000-0000-0000-0000-000000000001', active_semester_id());
insert into class_guardians (class_id, teacher_id, semester_id) values ('34000000-0000-0000-0000-00000000000a','14000000-0000-0000-0000-000000000002', active_semester_id());
reset role;

-- ===== Guru membuat tugas =====
select pg_temp.login('00000000-0000-0000-0000-0000000004b1');
insert into assignments (id, teaching_assignment_id, title, submission_types, start_at, due_at, max_score, allow_late, status) values
 ('64000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','Laporan pengamatan', array['text','file'], now() - interval '1 day', now() + interval '3 days', 100, true, 'published'),
 ('64000000-0000-0000-0000-000000000002','54000000-0000-0000-0000-000000000001','Tugas lewat tenggat (ketat)', array['link'], now() - interval '5 days', now() - interval '1 day', 100, false, 'published'),
 ('64000000-0000-0000-0000-000000000003','54000000-0000-0000-0000-000000000001','Tugas lewat tenggat (boleh terlambat)', array['text'], now() - interval '5 days', now() - interval '1 day', 50, true, 'published'),
 ('64000000-0000-0000-0000-000000000004','54000000-0000-0000-0000-000000000001','Draf tugas', array['text'], now(), now() + interval '7 days', 100, true, 'draft');
select pg_temp.check((select published_at is not null from assignments where id='64000000-0000-0000-0000-000000000001'), 'published_at tugas terisi saat terbit');
select pg_temp.expect_error($$insert into assignments (teaching_assignment_id, title, submission_types, start_at, due_at) values ('54000000-0000-0000-0000-000000000001','Tanggal salah', array['text'], now(), now() - interval '1 hour')$$, 'tenggat sebelum tanggal mulai ditolak');
select pg_temp.expect_error($$insert into assignments (teaching_assignment_id, title, submission_types, due_at) values ('54000000-0000-0000-0000-000000000001','Jenis salah', array['video'], now() + interval '1 day')$$, 'jenis pengumpulan tidak dikenal ditolak');
select pg_temp.check(can_write_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/lampiran/lembar.pdf'), 'guru boleh mengunggah lampiran tugas');
select pg_temp.check(not can_write_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000001/x.pdf'), 'guru tidak boleh menulis ke folder jawaban siswa');
select pg_temp.check(can_delete_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000001/x.pdf'), 'guru boleh menghapus berkas jawaban siswa (membersihkan tugas)');
reset role;

-- Guru wali (bukan pengampu) tidak bisa membuat tugas / menilai
select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
select pg_temp.expect_error($$insert into assignments (teaching_assignment_id, title, due_at) values ('54000000-0000-0000-0000-000000000001','Bukan milikku', now() + interval '1 day')$$, 'wali kelas tidak bisa membuat tugas di mapel guru lain');
select pg_temp.check((select count(*) from assignments) = 3, 'wali kelas melihat 3 tugas terbit (bukan draf)');
reset role;

-- ===== Siswa A =====
select pg_temp.login('00000000-0000-0000-0000-0000000004c1');
select pg_temp.check((select count(*) from get_my_assignments()) = 3, 'siswa melihat 3 tugas terbit di kelasnya');
select pg_temp.check(not exists (select 1 from assignments where status = 'draft'), 'siswa tidak melihat tugas draf');
select pg_temp.check(can_write_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000001/jawaban.pdf'), 'siswa boleh mengunggah ke folder jawabannya');
select pg_temp.check(not can_write_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000002/jawaban.pdf'), 'siswa tidak boleh mengunggah ke folder siswa lain');
select pg_temp.check(not can_read_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000002/j.pdf'), 'siswa tidak boleh membaca jawaban siswa lain');
select pg_temp.check(can_read_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/lampiran/lembar.pdf'), 'siswa boleh membaca lampiran tugas terbit');
select pg_temp.check(not can_read_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000004/lampiran/lembar.pdf'), 'siswa tidak boleh membaca lampiran tugas draf');
select pg_temp.check((save_submission('64000000-0000-0000-0000-000000000001','save','Draf jawaban')->>'status') = 'draft', 'simpan draf jawaban');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000001','submit',null,null,'[{"storage_path":"54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000002/curang.pdf"}]')$$, 'berkas milik siswa lain ditolak saat mengumpulkan');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000001','submit','   ')$$, 'jawaban kosong tidak bisa dikumpulkan');
select pg_temp.check((save_submission('64000000-0000-0000-0000-000000000001','submit','Jawaban final',null,'[{"storage_path":"54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000001/jawaban.pdf","size_bytes":1200}]')->>'is_late') = 'false', 'mengumpulkan tepat waktu');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000001','save','Ubah setelah kumpul')$$, 'jawaban terkumpul tidak bisa diubah tanpa membatalkan');
select pg_temp.check(not can_write_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000001/baru.pdf'), 'setelah terkumpul, siswa tidak bisa mengunggah berkas baru');
select pg_temp.check((save_submission('64000000-0000-0000-0000-000000000001','unsubmit')->>'status') = 'draft', 'membatalkan pengumpulan sebelum dinilai');
select pg_temp.check((save_submission('64000000-0000-0000-0000-000000000001','submit','Jawaban final v2')->>'status') = 'submitted', 'mengumpulkan ulang');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000002','submit',null,'https://drive.google.com/x')$$, 'tenggat lewat & tidak boleh terlambat → ditolak (waktu server)');
select pg_temp.check((save_submission('64000000-0000-0000-0000-000000000003','submit','Terlambat')->>'is_late') = 'true', 'pengumpulan setelah tenggat ditandai terlambat');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000004','submit','Draf')$$, 'tidak bisa mengumpulkan tugas draf');
select pg_temp.expect_error($$insert into assignment_submissions (assignment_id, student_id, teaching_assignment_id, status) values ('64000000-0000-0000-0000-000000000002','24000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','submitted')$$, 'siswa tidak bisa menulis tabel pengumpulan langsung');
select pg_temp.expect_error($$insert into assignment_grades (assignment_id, student_id, score) values ('64000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001',100)$$, 'siswa tidak bisa memberi nilai sendiri');
select pg_temp.expect_error($$select * from get_assignment_board('64000000-0000-0000-0000-000000000001')$$, 'siswa tidak bisa melihat papan pemeriksaan');
reset role;

-- Siswa B (sekelas): tidak melihat jawaban siswa A
select pg_temp.login('00000000-0000-0000-0000-0000000004c2');
select pg_temp.check((select count(*) from assignment_submissions) = 0, 'siswa tidak melihat pengumpulan teman sekelas');
select pg_temp.check(not can_delete_assignment_object('54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/siswa/24000000-0000-0000-0000-000000000001/jawaban.pdf'), 'siswa tidak bisa menghapus berkas jawaban teman');
reset role;

-- Siswa kelas lain
select pg_temp.login('00000000-0000-0000-0000-0000000004c3');
select pg_temp.check((select count(*) from get_my_assignments()) = 0, 'siswa kelas lain tidak melihat tugas kelas VII-X');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000001','submit','Menyusup')$$, 'siswa kelas lain tidak bisa mengumpulkan');
reset role;

-- ===== Guru menilai =====
select pg_temp.login('00000000-0000-0000-0000-0000000004b1');
select pg_temp.check((select count(*) from get_grading_queue()) = 2, 'antrean pemeriksaan: 2 tugas menunggu dinilai');
select pg_temp.check((select count(*) from get_assignment_board('64000000-0000-0000-0000-000000000001')) = 2, 'papan pemeriksaan berisi semua siswa kelas');
insert into assignment_grades (assignment_id, student_id, score, feedback) values ('64000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001', 88, 'Bagus, lengkapi kesimpulan.');
insert into assignment_grades (assignment_id, student_id, score, feedback) values ('64000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002', 0, 'Tidak mengumpulkan.');
select pg_temp.check((select submission_id is not null from assignment_grades where student_id='24000000-0000-0000-0000-000000000001'), 'nilai otomatis terhubung ke pengumpulannya');
select pg_temp.expect_error($$insert into assignment_grades (assignment_id, student_id, score) values ('64000000-0000-0000-0000-000000000003','24000000-0000-0000-0000-000000000001', 60)$$, 'nilai melebihi maksimum ditolak');
select pg_temp.expect_error($$insert into assignment_grades (assignment_id, student_id, score) values ('64000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000003', 70)$$, 'nilai untuk siswa di luar kelas ditolak');
select pg_temp.check((select count(*) from get_grading_queue()) = 1, 'antrean berkurang setelah dinilai');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000004c1');
select pg_temp.check((select score from get_my_assignments() where id='64000000-0000-0000-0000-000000000001') is null, 'siswa belum melihat nilai sebelum diterbitkan');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000001','unsubmit')$$, 'tidak bisa membatalkan setelah guru mulai menilai');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000004b2');
update assignment_grades set score = 100;
select pg_temp.expect_error($$select publish_grades('64000000-0000-0000-0000-000000000001')$$, 'wali kelas tidak bisa menerbitkan nilai');
select pg_temp.check((select count(*) from get_assignment_board('64000000-0000-0000-0000-000000000001')) = 2, 'wali kelas dapat memantau papan pengumpulan');
reset role;
select pg_temp.check((select score from assignment_grades where student_id='24000000-0000-0000-0000-000000000001' and assignment_id='64000000-0000-0000-0000-000000000001') = 88, 'wali kelas tidak bisa mengubah nilai guru lain');

select pg_temp.login('00000000-0000-0000-0000-0000000004b1');
select pg_temp.check(publish_grades('64000000-0000-0000-0000-000000000001') = 2, 'guru menerbitkan 2 nilai');
update assignment_grades set score = 90 where student_id='24000000-0000-0000-0000-000000000001' and assignment_id='64000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.check((select count(*) from audit_logs where entity='assignment_grades' and action='assignment_grades.update') >= 1, 'perubahan nilai tercatat di audit log (nilai lama & baru)');

select pg_temp.login('00000000-0000-0000-0000-0000000004c1');
select pg_temp.check((select score from get_my_assignments() where id='64000000-0000-0000-0000-000000000001') = 90, 'siswa melihat nilai terbit');
select pg_temp.check((select feedback from assignment_grades) = 'Bagus, lengkapi kesimpulan.', 'siswa membaca umpan balik guru');
select pg_temp.check((select count(*) from assignment_grades) = 1, 'siswa hanya melihat nilainya sendiri');
select pg_temp.expect_error($$select save_submission('64000000-0000-0000-0000-000000000001','save','Ubah setelah dinilai')$$, 'tugas yang sudah dinilai terkunci');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
update assignments set attachments = '[{"type":"pdf","title":"LKPD","storage_path":"54000000-0000-0000-0000-000000000001/64000000-0000-0000-0000-000000000001/lampiran/lkpd.pdf","size_bytes":500}]' where id = '64000000-0000-0000-0000-000000000001';
select pg_temp.check((admin_storage_usage()->>'assignment_bytes')::int = 500, 'statistik penyimpanan memasukkan berkas tugas');
reset role;
rollback;
