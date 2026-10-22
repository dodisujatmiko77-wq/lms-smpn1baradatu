-- Uji hak akses & perhitungan laporan Tahap 7. Jalankan setelah stub + migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000007a1','adm7@lms.test','{"username":"adm7","full_name":"Admin Tujuh"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000007b1','gr71@lms.test','{"username":"gr71","full_name":"Guru IPA"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000007b2','gr72@lms.test','{"username":"gr72","full_name":"Guru IPS"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000007b3','gr73@lms.test','{"username":"gr73","full_name":"Wali Kelas"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000007b4','gr74@lms.test','{"username":"gr74","full_name":"Guru Kelas Lain"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000007c1','7700000001@lms.test','{"username":"7700000001","full_name":"Ani"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000007c2','7700000002@lms.test','{"username":"7700000002","full_name":"Budi"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000007c3','7700000003@lms.test','{"username":"7700000003","full_name":"Citra"}','{"roles":["student"]}');
insert into teachers (id, profile_id) values
 ('17000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000007b1'),
 ('17000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000007b2'),
 ('17000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000007b3'),
 ('17000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000007b4');
insert into students (id, profile_id, nisn, gender, parent_phone) values
 ('27000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000007c1','7700000001','P','081200000001'),
 ('27000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000007c2','7700000002','L','081200000002'),
 ('27000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000007c3','7700000003','P', null);

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select admin_create_academic_year('2070/2071','2070-07-15','2071-06-30');
select set_active_semester((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2070/2071' and s.number = 1));
insert into classes (id, academic_year_id, grade, name) values
 ('37000000-0000-0000-0000-00000000000a', active_academic_year_id(), 7, 'VII-R'),
 ('37000000-0000-0000-0000-00000000000b', active_academic_year_id(), 7, 'VII-S');
insert into subjects (id, code, name) values
 ('47000000-0000-0000-0000-000000000001','IPA7','IPA'), ('47000000-0000-0000-0000-000000000002','IPS7','IPS');
select enroll_students('37000000-0000-0000-0000-00000000000a', array['27000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000002']::uuid[]);
select enroll_students('37000000-0000-0000-0000-00000000000b', array['27000000-0000-0000-0000-000000000003']::uuid[]);
insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id) values
 ('57000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-00000000000a','47000000-0000-0000-0000-000000000001', active_semester_id()),
 ('57000000-0000-0000-0000-000000000002','17000000-0000-0000-0000-000000000002','37000000-0000-0000-0000-00000000000a','47000000-0000-0000-0000-000000000002', active_semester_id()),
 ('57000000-0000-0000-0000-000000000003','17000000-0000-0000-0000-000000000004','37000000-0000-0000-0000-00000000000b','47000000-0000-0000-0000-000000000001', active_semester_id());
insert into class_guardians (class_id, teacher_id, semester_id) values ('37000000-0000-0000-0000-00000000000a','17000000-0000-0000-0000-000000000003', active_semester_id());
reset role;

-- ===== Data belajar =====
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
insert into lessons (id, teaching_assignment_id, title, status, content_html) values
 ('67000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','Sel','published','<p>x</p>'),
 ('67000000-0000-0000-0000-000000000002','57000000-0000-0000-0000-000000000001','Jaringan','published','<p>x</p>'),
 ('67000000-0000-0000-0000-000000000003','57000000-0000-0000-0000-000000000001','Organ','published','<p>x</p>');
insert into assignments (id, teaching_assignment_id, title, submission_types, start_at, due_at, max_score, status, description) values
 ('77000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','Laporan sel', array['text'], now() - interval '5 days', now() - interval '1 day', 100, 'published', 'x');
insert into question_banks (id, teacher_id, subject_id, name) values ('87000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001','Bank IPA');
insert into quiz_questions (id, bank_id, type, body, answer_key, points) values ('97000000-0000-0000-0000-000000000001','87000000-0000-0000-0000-000000000001','true_false','Sel adalah unit terkecil','true', 10);
insert into quizzes (id, teaching_assignment_id, title, open_at, close_at) values ('a7000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','Kuis sel', now() - interval '3 days', now() - interval '2 days');
insert into quiz_question_items (quiz_id, question_id) values ('a7000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001');
update quizzes set status = 'published' where id = 'a7000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007c1');
select mark_lesson_progress(id, 'complete') from lessons where teaching_assignment_id = '57000000-0000-0000-0000-000000000001';
reset role;
insert into assignment_submissions (assignment_id, student_id, teaching_assignment_id, status, text_answer, submitted_at)
values ('77000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','submitted','Jawaban', now() - interval '2 days');
insert into quiz_attempts (quiz_id, student_id, teaching_assignment_id, attempt_no, status, started_at, deadline_at, submitted_at, question_order, score_auto, score_total, max_score)
values ('a7000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001', 1, 'submitted', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', now() - interval '3 days', '[]', 10, 10, 10);
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
insert into assignment_grades (assignment_id, student_id, score) values ('77000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001', 90);
select publish_grades('77000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b2');
insert into assignments (id, teaching_assignment_id, title, submission_types, start_at, due_at, max_score, status, description) values
 ('77000000-0000-0000-0000-000000000002','57000000-0000-0000-0000-000000000002','Peta', array['text'], now() - interval '5 days', now() + interval '3 days', 50, 'published', 'x');
insert into assignment_grades (assignment_id, student_id, score) values ('77000000-0000-0000-0000-000000000002','27000000-0000-0000-0000-000000000001', 30);
select publish_grades('77000000-0000-0000-0000-000000000002');
reset role;

select pg_temp.check((select count(*) from activity_events where event_type = 'lesson_complete') = 3, 'aktivitas siswa tercatat otomatis (3 materi selesai)');
select pg_temp.check((select count(*) from activity_events where event_type in ('lesson_publish','task_publish','quiz_publish','grade') and role = 'teacher') >= 7, 'aktivitas guru tercatat (terbit materi/tugas/kuis, menilai)');

-- ===== Laporan kelas =====
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select pg_temp.check((select count(*) from report_class_summary('37000000-0000-0000-0000-00000000000a')) = 4, 'admin: laporan kelas 2 siswa × 2 mapel');
select pg_temp.check((select overall_avg from report_class_summary('37000000-0000-0000-0000-00000000000a') where full_name = 'Ani' and subject_name = 'IPA') = 95, 'rata-rata IPA Ani = (tugas 90 + kuis 100)/2 = 95');
select pg_temp.check((select overall_avg from report_class_summary('37000000-0000-0000-0000-00000000000a') where full_name = 'Ani' and subject_name = 'IPS') = 60, 'nilai IPS Ani 30/50 = 60');
select pg_temp.check((select task_missing = 1 and quiz_missed = 1 and lessons_done = 0 from report_class_summary('37000000-0000-0000-0000-00000000000a') where full_name = 'Budi' and subject_name = 'IPA'), 'Budi: 1 tugas & 1 kuis terlewat, 0 materi selesai');
select pg_temp.check((select lessons_done = 3 and lessons_total = 3 from report_class_summary('37000000-0000-0000-0000-00000000000a') where full_name = 'Ani' and subject_name = 'IPA'), 'Ani menuntaskan 3/3 materi IPA');
select pg_temp.check((select count(*) from get_report_classes()) = 2, 'admin bisa memilih semua kelas');
select pg_temp.expect_error($$select * from activity_events$$, 'log aktivitas tidak bisa dibaca langsung (hanya lewat laporan)');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
select pg_temp.check((select count(*) from report_class_summary('37000000-0000-0000-0000-00000000000a')) = 4, 'wali kelas: semua mapel kelas binaan');
select pg_temp.check((select count(*) from get_report_classes() where is_guardian) = 1, 'wali kelas melihat kelas binaannya');
select pg_temp.expect_error($$select * from report_class_summary('37000000-0000-0000-0000-00000000000b')$$, 'wali kelas tidak bisa melihat laporan kelas lain');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select pg_temp.check((select count(*) from report_class_summary('37000000-0000-0000-0000-00000000000a')) = 2, 'guru mapel hanya melihat baris mapelnya');
select pg_temp.check(not exists (select 1 from report_class_summary('37000000-0000-0000-0000-00000000000a') where subject_name = 'IPS'), 'guru IPA tidak melihat nilai IPS');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b4');
select pg_temp.expect_error($$select * from report_class_summary('37000000-0000-0000-0000-00000000000a')$$, 'guru yang tidak mengajar kelas ditolak');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007c1');
select pg_temp.expect_error($$select * from report_class_summary('37000000-0000-0000-0000-00000000000a')$$, 'siswa tidak bisa membuka laporan kelas');
select pg_temp.check((select count(*) from get_report_classes()) = 0, 'siswa tidak punya kelas untuk dilaporkan');
select pg_temp.check((select count(*) from monitor_learning()) = 0, 'siswa tidak mendapat data monitoring');
select pg_temp.expect_error($$select get_student_report('27000000-0000-0000-0000-000000000002')$$, 'siswa tidak bisa melihat laporan teman');
reset role;

-- ===== Rekap nilai per ruang kelas =====
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select pg_temp.check(jsonb_array_length(report_ta_grades('57000000-0000-0000-0000-000000000001')->'columns') = 2, 'rekap nilai: kolom tugas + kuis');
select pg_temp.check((report_ta_grades('57000000-0000-0000-0000-000000000001')->'students'->0->'scores'->'77000000-0000-0000-0000-000000000001'->>'pct')::numeric = 90, 'rekap nilai: nilai tugas Ani 90');
select pg_temp.check((report_ta_grades('57000000-0000-0000-0000-000000000001')->'students'->1->>'missing')::int = 1, 'rekap nilai: Budi 1 tugas belum dikumpulkan');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b2');
select pg_temp.expect_error($$select report_ta_grades('57000000-0000-0000-0000-000000000001')$$, 'guru lain tidak bisa melihat rekap nilai mapel lain');
reset role;

-- ===== Monitoring =====
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
select pg_temp.check((select count(*) from monitor_learning()) = 3, 'admin memantau semua ruang kelas semester aktif');
select pg_temp.check((select lessons_published = 3 and avg_completion = 50 from monitor_learning() where teaching_assignment_id = '57000000-0000-0000-0000-000000000001'), 'monitoring IPA: 3 materi, penyelesaian rata-rata 50%');
select pg_temp.check((select lessons_published = 0 from monitor_learning() where teaching_assignment_id = '57000000-0000-0000-0000-000000000002'), 'ruang kelas tanpa materi terdeteksi');
select pg_temp.check((select count(*) from teacher_activity() where lessons = 3) = 1, 'keaktifan guru: 3 materi diterbitkan');
select pg_temp.check((select count(*) from activity_daily(30)) = 30, 'grafik aktivitas 30 hari');
select pg_temp.check((select sum(student_events) from activity_daily(30)) >= 3, 'grafik memuat aktivitas siswa');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select pg_temp.check((select count(*) from monitor_learning()) = 1, 'guru hanya memantau ruang kelasnya');
select pg_temp.expect_error($$select * from activity_daily(30)$$, 'guru tidak bisa melihat grafik seluruh sekolah');
select pg_temp.check((select count(*) from activity_daily(7, null, '57000000-0000-0000-0000-000000000001')) = 7, 'guru melihat grafik aktivitas ruang kelasnya');
select pg_temp.expect_error($$select * from teacher_activity()$$, 'keaktifan guru hanya untuk admin');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
select pg_temp.check((select count(*) from monitor_assignments('37000000-0000-0000-0000-00000000000a')) = 2, 'wali kelas memantau tugas lintas mapel');
select pg_temp.check((select missing from monitor_assignments('37000000-0000-0000-0000-00000000000a') where id = '77000000-0000-0000-0000-000000000001') = 1, 'tugas lewat tenggat: 1 siswa belum mengumpulkan');
select pg_temp.check((select full_name from assignment_missing_students('77000000-0000-0000-0000-000000000001')) = 'Budi', 'daftar siswa yang belum mengumpulkan');
select pg_temp.check((select count(*) from monitor_assignments('37000000-0000-0000-0000-00000000000b')) = 0, 'wali kelas tidak melihat tugas kelas lain');
select pg_temp.check((select count(*) from activity_daily(14, '37000000-0000-0000-0000-00000000000a')) = 14, 'wali kelas melihat grafik aktivitas kelasnya');

-- ===== Tindak lanjut =====
select pg_temp.check((select full_name from class_followups('37000000-0000-0000-0000-00000000000a') limit 1) = 'Budi', 'siswa paling perlu tindak lanjut di urutan teratas');
select pg_temp.check((select 'Belum pernah aktif di LMS' = any(reasons) from class_followups('37000000-0000-0000-0000-00000000000a') where full_name = 'Budi'), 'alasan: belum pernah aktif');
select pg_temp.check((select below_kkm_subjects = array['IPS'] from class_followups('37000000-0000-0000-0000-00000000000a') where full_name = 'Ani'), 'Ani: nilai IPS di bawah KKM 75');
reset role;
update school_settings set kkm = 50;
select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
select pg_temp.check((select cardinality(below_kkm_subjects) = 0 from class_followups('37000000-0000-0000-0000-00000000000a') where full_name = 'Ani'), 'KKM diubah ke 50 → Ani tidak lagi di bawah KKM');
reset role;
update school_settings set kkm = 75;
select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
update school_settings set kkm = 10;
reset role;
select pg_temp.check((select kkm from school_settings) = 75, 'guru/wali kelas tidak bisa mengubah KKM');
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
update school_settings set kkm = 70;
reset role;
select pg_temp.check((select kkm from school_settings) = 70, 'admin bisa mengubah KKM');
update school_settings set kkm = 75;
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select pg_temp.expect_error($$select * from class_followups('37000000-0000-0000-0000-00000000000a')$$, 'tindak lanjut hanya untuk wali kelas/admin');
reset role;

-- ===== Laporan siswa =====
select pg_temp.login('00000000-0000-0000-0000-0000000007b3');
select pg_temp.check(jsonb_array_length(get_student_report('27000000-0000-0000-0000-000000000001')->'subjects') = 2, 'laporan siswa (wali kelas): semua mapel');
select pg_temp.check((get_student_report('27000000-0000-0000-0000-000000000001')->'student'->>'parent_phone') = '081200000001', 'wali kelas melihat nomor orang tua');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b1');
select pg_temp.check(jsonb_array_length(get_student_report('27000000-0000-0000-0000-000000000001')->'subjects') = 1, 'laporan siswa (guru mapel): hanya mapelnya');
select pg_temp.check((get_student_report('27000000-0000-0000-0000-000000000001')->'student'->>'parent_phone') is null, 'guru mapel tidak melihat nomor orang tua');
select pg_temp.check((select count(*) from jsonb_array_elements(get_student_report('27000000-0000-0000-0000-000000000002')->'tasks') t where t->>'status' = 'missing') = 1, 'laporan siswa: tugas terlewat ditandai');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000007b4');
select pg_temp.expect_error($$select get_student_report('27000000-0000-0000-0000-000000000001')$$, 'guru kelas lain tidak bisa melihat laporan siswa');
reset role;
rollback;
