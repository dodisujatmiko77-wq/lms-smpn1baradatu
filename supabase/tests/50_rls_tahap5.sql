-- Uji RLS & aturan kuis/CBT Tahap 5. Jalankan setelah stub + migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000005a1','adm5@lms.test','{"username":"adm5","full_name":"Admin"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000005b1','gr51@lms.test','{"username":"gr51","full_name":"Guru MTK"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000005b2','gr52@lms.test','{"username":"gr52","full_name":"Guru Wali"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000005c1','5555500001@lms.test','{"username":"5555500001","full_name":"Siswa A"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000005c2','5555500002@lms.test','{"username":"5555500002","full_name":"Siswa B"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000005c3','5555500003@lms.test','{"username":"5555500003","full_name":"Siswa Lain"}','{"roles":["student"]}');
insert into teachers (id, profile_id) values
 ('15000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000005b1'),
 ('15000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000005b2');
insert into students (id, profile_id, nisn, gender) values
 ('25000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000005c1','5555500001','P'),
 ('25000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000005c2','5555500002','L'),
 ('25000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000005c3','5555500003','L');

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select admin_create_academic_year('2050/2051','2050-07-15','2051-06-30');
select set_active_semester((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2050/2051' and s.number = 1));
insert into classes (id, academic_year_id, grade, name) values
 ('35000000-0000-0000-0000-00000000000a', active_academic_year_id(), 8, 'VIII-X'),
 ('35000000-0000-0000-0000-00000000000b', active_academic_year_id(), 8, 'VIII-Y');
insert into subjects (id, code, name) values ('45000000-0000-0000-0000-000000000001','MTK5','Matematika');
select enroll_students('35000000-0000-0000-0000-00000000000a', array['25000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000002']::uuid[]);
select enroll_students('35000000-0000-0000-0000-00000000000b', array['25000000-0000-0000-0000-000000000003']::uuid[]);
insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id) values
 ('55000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-00000000000a','45000000-0000-0000-0000-000000000001', active_semester_id()),
 ('55000000-0000-0000-0000-000000000002','15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-00000000000b','45000000-0000-0000-0000-000000000001', active_semester_id());
insert into class_guardians (class_id, teacher_id, semester_id) values ('35000000-0000-0000-0000-00000000000a','15000000-0000-0000-0000-000000000002', active_semester_id());
reset role;

-- ===== Guru menyusun bank soal =====
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
insert into question_banks (id, teacher_id, subject_id, grade, name) values
 ('65000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000001', 8, 'Bilangan bulat');
insert into quiz_questions (id, bank_id, type, body, answer_key, explanation, points, position) values
 ('75000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','mcq','Hasil -3 + 5 = ...', null, 'Geser 5 ke kanan dari -3.', 2, 1),
 ('75000000-0000-0000-0000-000000000002','65000000-0000-0000-0000-000000000001','true_false','-7 lebih kecil dari -2', 'true', null, 1, 2),
 ('75000000-0000-0000-0000-000000000003','65000000-0000-0000-0000-000000000001','short','Lawan dari 9 adalah ...', E'-9\nmin 9|negatif 9', null, 1, 3),
 ('75000000-0000-0000-0000-000000000004','65000000-0000-0000-0000-000000000001','essay','Jelaskan cara menjumlahkan bilangan negatif.', 'Pedoman: gunakan garis bilangan.', null, 4, 4);
insert into quiz_options (id, question_id, body, is_correct, position) values
 ('85000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','2', true, 1),
 ('85000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','-8', false, 2),
 ('85000000-0000-0000-0000-000000000003','75000000-0000-0000-0000-000000000001','8', false, 3);
select pg_temp.expect_error($$insert into quiz_questions (bank_id, type, body, answer_key) values ('65000000-0000-0000-0000-000000000001','true_false','Salah kunci','ya')$$, 'kunci benar/salah harus true/false');
select pg_temp.expect_error($$insert into quiz_questions (bank_id, type, body) values ('65000000-0000-0000-0000-000000000001','short','Isian tanpa kunci')$$, 'soal isian wajib punya kunci');
select pg_temp.expect_error($$insert into question_banks (teacher_id, subject_id, name) values ('15000000-0000-0000-0000-000000000002','45000000-0000-0000-0000-000000000001','Atas nama guru lain')$$, 'guru tidak bisa membuat bank soal atas nama guru lain');

-- Kuis
insert into quizzes (id, teaching_assignment_id, title, open_at, close_at, duration_minutes, max_attempts, review_mode) values
 ('95000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','Kuis 1', now() - interval '1 hour', now() + interval '2 days', 20, 2, 'after_submit'),
 ('95000000-0000-0000-0000-000000000002','55000000-0000-0000-0000-000000000001','Ujian (belum dibuka)', now() + interval '1 day', now() + interval '2 days', 60, 1, 'after_close'),
 ('95000000-0000-0000-0000-000000000003','55000000-0000-0000-0000-000000000001','Kuis kunci rahasia', now() - interval '1 hour', now() + interval '2 days', 30, 1, 'never');
select pg_temp.expect_error($$insert into quizzes (teaching_assignment_id, title, open_at, close_at, status) values ('55000000-0000-0000-0000-000000000001','Langsung terbit', now(), now() + interval '1 day', 'published')$$, 'kuis tanpa soal tidak bisa diterbitkan');
select pg_temp.expect_error($$insert into quizzes (teaching_assignment_id, title, open_at, close_at) values ('55000000-0000-0000-0000-000000000001','Jadwal salah', now(), now() - interval '1 hour')$$, 'waktu tutup sebelum waktu buka ditolak');
insert into quiz_question_items (quiz_id, question_id, position) select '95000000-0000-0000-0000-000000000001', id, position from quiz_questions where bank_id = '65000000-0000-0000-0000-000000000001';
insert into quiz_question_items (quiz_id, question_id, position) values
 ('95000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001',1),
 ('95000000-0000-0000-0000-000000000003','75000000-0000-0000-0000-000000000002',1);
update quizzes set status = 'published' where id in ('95000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from quizzes where published_at is not null) = 3, 'kuis diterbitkan (published_at terisi)');
reset role;
select pg_temp.check((select count(*) from audit_logs where action = 'quizzes.publish') = 3, 'penerbitan kuis tercatat di audit log');

-- Guru wali (bukan pengampu)
select pg_temp.login('00000000-0000-0000-0000-0000000005b2');
select pg_temp.check((select count(*) from question_banks) = 0 and (select count(*) from quiz_questions) = 0, 'guru lain tidak melihat bank soal & kunci jawaban guru lain');
select pg_temp.expect_error($$insert into quiz_question_items (quiz_id, question_id) values ('95000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002')$$, 'wali kelas tidak bisa mengubah soal kuis');
select pg_temp.check((select count(*) from quizzes) = 3, 'wali kelas melihat kuis terbit di kelas perwaliannya');
reset role;

-- ===== Siswa A mengerjakan =====
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');
select pg_temp.check((select count(*) from get_my_quizzes()) = 3, 'siswa melihat 3 kuis terbit');
select pg_temp.check((select count(*) from quiz_questions) = 0 and (select count(*) from quiz_options) = 0, 'siswa tidak bisa membaca tabel soal/opsi (kunci)');
select pg_temp.check((select count(*) from quiz_question_items) = 0, 'siswa tidak bisa membaca daftar soal kuis');
select pg_temp.expect_error($$select start_quiz_attempt('95000000-0000-0000-0000-000000000002')$$, 'kuis belum dibuka ditolak (waktu server)');
create temp table t_att (k text primary key, id uuid);
grant all on t_att to authenticated;
insert into t_att values ('a1', start_quiz_attempt('95000000-0000-0000-0000-000000000001'));
select pg_temp.check(start_quiz_attempt('95000000-0000-0000-0000-000000000001') = (select id from t_att where k='a1'), 'memulai lagi melanjutkan percobaan yang sama');
select pg_temp.check((get_attempt((select id from t_att where k='a1'))->'questions')::text not like '%is_correct%'
   and (get_attempt((select id from t_att where k='a1'))->'questions')::text not like '%answer_key%'
   and (get_attempt((select id from t_att where k='a1'))->'questions')::text not like '%min 9%', 'soal dikirim TANPA kunci jawaban');
select pg_temp.check(jsonb_array_length(get_attempt((select id from t_att where k='a1'))->'questions') = 4, 'empat soal dikirim');
select pg_temp.check((get_attempt((select id from t_att where k='a1'))->>'server_now') is not null, 'waktu server dikirim untuk timer');
select pg_temp.check((select deadline_at - started_at from quiz_attempts) is null, 'siswa tidak bisa membaca tabel percobaan langsung');
select pg_temp.expect_error($$select get_attempt_result((select id from t_att where k='a1'))$$, 'hasil belum bisa dilihat saat masih mengerjakan');
select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001');
select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000002', null, 'true');
select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000003', null, '  Negatif   9 ');
select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000004', null, 'Pakai garis bilangan.');
select pg_temp.expect_error($$select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-0000000000ff')$$, 'opsi dari soal lain ditolak');
select pg_temp.expect_error($$select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000002', null, 'mungkin')$$, 'jawaban benar/salah tidak valid ditolak');
select pg_temp.expect_error($$insert into quiz_answers (attempt_id, question_id, score) values ((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000004', 4)$$, 'siswa tidak bisa menulis tabel jawaban langsung');
select pg_temp.expect_error($$update quiz_attempts set deadline_at = now() + interval '1 day'$$, 'siswa tidak bisa memperpanjang waktu sendiri');
select report_focus_lost((select id from t_att where k='a1'));
select submit_quiz_attempt((select id from t_att where k='a1'));
select pg_temp.expect_error($$select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002')$$, 'jawaban tidak bisa diubah setelah dikumpulkan');
select pg_temp.check((get_attempt_result((select id from t_att where k='a1'))->>'score_total')::numeric = 4, 'nilai otomatis PG+B/S+isian (isian tidak peka huruf/spasi) = 4');
select pg_temp.check((get_attempt_result((select id from t_att where k='a1'))->>'needs_manual')::boolean, 'esai menunggu dinilai guru');
select pg_temp.check((get_attempt_result((select id from t_att where k='a1'))->>'review_available')::boolean, 'pembahasan tersedia (mode: setelah mengumpulkan)');
-- Percobaan kedua (batas 2), dibiarkan habis waktunya
insert into t_att values ('a2', start_quiz_attempt('95000000-0000-0000-0000-000000000001'));
select save_quiz_answer((select id from t_att where k='a2'), '75000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000003');
reset role;
update quiz_attempts set deadline_at = now() - interval '2 minutes', started_at = now() - interval '22 minutes' where id = (select id from t_att where k='a2');
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');
select pg_temp.expect_error($$select save_quiz_answer((select id from t_att where k='a2'), '75000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001')$$, 'autosave ditolak setelah waktu habis (waktu server)');
select pg_temp.check((select in_progress_attempt_id is null and attempts_used = 2 from get_my_quizzes() where id = '95000000-0000-0000-0000-000000000001'), 'percobaan yang habis waktunya ditutup otomatis');
select pg_temp.check((get_attempt_result((select id from t_att where k='a2'))->>'auto_submitted')::boolean, 'percobaan ditandai dikumpulkan otomatis');
select pg_temp.expect_error($$select start_quiz_attempt('95000000-0000-0000-0000-000000000001')$$, 'batas percobaan (2) ditegakkan');
select pg_temp.check((select count(*) from get_my_quiz_attempts('95000000-0000-0000-0000-000000000001')) = 2, 'riwayat percobaan siswa: 2 percobaan');
-- Kuis dengan mode pembahasan "tidak pernah"
insert into t_att values ('a3', start_quiz_attempt('95000000-0000-0000-0000-000000000003'));
select save_quiz_answer((select id from t_att where k='a3'), '75000000-0000-0000-0000-000000000002', null, 'false');
select submit_quiz_attempt((select id from t_att where k='a3'));
select pg_temp.check(not (get_attempt_result((select id from t_att where k='a3'))->>'review_available')::boolean
   and get_attempt_result((select id from t_att where k='a3'))->'review' = 'null'::jsonb, 'kunci & pembahasan tidak dikirim bila guru tidak mengizinkan');
reset role;

-- Siswa B: tidak bisa mengakses percobaan siswa A
select pg_temp.login('00000000-0000-0000-0000-0000000005c2');
select pg_temp.expect_error($$select get_attempt((select id from t_att where k='a1'))$$, 'siswa tidak bisa membuka percobaan teman');
select pg_temp.expect_error($$select get_attempt_result((select id from t_att where k='a1'))$$, 'siswa tidak bisa melihat hasil teman');
select pg_temp.expect_error($$select save_quiz_answer((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001')$$, 'siswa tidak bisa menulis jawaban di percobaan teman');
insert into t_att values ('b1', start_quiz_attempt('95000000-0000-0000-0000-000000000001'));
select pg_temp.check((select (get_attempt(id)->'questions'->0->>'id') is not null from t_att where k='b1'), 'siswa B mendapat soal');
reset role;
-- Urutan acak disimpan per percobaan
select pg_temp.check((select count(*) from quiz_attempts where question_order is not null and jsonb_array_length(question_order) = 4 and quiz_id = '95000000-0000-0000-0000-000000000001') = 3, 'susunan soal (acak) tersimpan per percobaan');

-- Siswa kelas lain
select pg_temp.login('00000000-0000-0000-0000-0000000005c3');
select pg_temp.check((select count(*) from get_my_quizzes()) = 0, 'siswa kelas lain tidak melihat kuis kelas VIII-X');
select pg_temp.expect_error($$select start_quiz_attempt('95000000-0000-0000-0000-000000000001')$$, 'siswa kelas lain tidak bisa mengerjakan');
reset role;

-- ===== Guru memeriksa =====
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
select pg_temp.check((select waiting from get_quiz_grading_queue() where quiz_id = '95000000-0000-0000-0000-000000000001') = 1, 'antrean penilaian esai: 1 percobaan');
select pg_temp.check((select participants from get_course_quizzes('55000000-0000-0000-0000-000000000001') where id = '95000000-0000-0000-0000-000000000001') = 2, 'ringkasan kuis: 2 peserta');
select pg_temp.check((select focus_lost from get_quiz_results('95000000-0000-0000-0000-000000000001') where student_id = '25000000-0000-0000-0000-000000000001') = 0, 'hasil per siswa (percobaan terakhir) tersedia');
select pg_temp.check((select (get_attempt_detail(id)->>'focus_lost_count')::int from t_att where k='a1') = 1, 'guru melihat jumlah keluar dari halaman ujian');
select pg_temp.check((select get_attempt_detail(id)::text like '%min 9%' from t_att where k='a1'), 'guru melihat kunci jawaban di detail');
select pg_temp.expect_error($$select grade_essay((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000004', 5)$$, 'nilai esai melebihi skor soal ditolak');
select pg_temp.expect_error($$select grade_essay((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000001', 1)$$, 'grade_essay hanya untuk soal esai');
select pg_temp.check((select (grade_essay(id, '75000000-0000-0000-0000-000000000004', 3)->>'score_total')::numeric from t_att where k='a1') = 7, 'nilai esai menambah total (4 + 3 = 7)');
select pg_temp.check(not (select needs_manual from quiz_attempts where id = (select id from t_att where k='a1')), 'percobaan tidak lagi menunggu penilaian');
select pg_temp.check(not exists (select 1 from get_quiz_grading_queue()), 'antrean esai kosong setelah dinilai');
select pg_temp.expect_error($$update quiz_options set is_correct = false where id = '85000000-0000-0000-0000-000000000001'$$, 'kunci soal yang sudah dikerjakan terkunci');
select pg_temp.expect_error($$delete from quiz_question_items where quiz_id = '95000000-0000-0000-0000-000000000001'$$, 'soal tidak bisa dicabut dari kuis yang sudah dikerjakan');
select pg_temp.expect_error($$delete from quiz_questions where id = '75000000-0000-0000-0000-000000000002'$$, 'soal yang dipakai kuis tidak bisa dihapus dari bank');
update quiz_questions set body = 'Hasil dari -3 + 5 adalah ...' where id = '75000000-0000-0000-0000-000000000001';
select pg_temp.check(true, 'perbaikan teks soal tetap boleh');
reset role;

-- Wali kelas memantau tetapi tidak menilai / mereset
select pg_temp.login('00000000-0000-0000-0000-0000000005b2');
select pg_temp.check((select count(*) from get_quiz_results('95000000-0000-0000-0000-000000000001')) = 2, 'wali kelas melihat hasil kuis kelasnya');
select pg_temp.expect_error($$select grade_essay((select id from t_att where k='a1'), '75000000-0000-0000-0000-000000000004', 4)$$, 'wali kelas tidak bisa menilai esai');
select pg_temp.expect_error($$select reset_quiz_attempt((select id from t_att where k='a1'))$$, 'wali kelas tidak bisa mereset percobaan');
reset role;

-- Siswa melihat nilai akhir
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');
select pg_temp.check((select best_score from get_my_quizzes() where id = '95000000-0000-0000-0000-000000000001') = 7, 'siswa melihat nilai terbaik setelah esai dinilai');
select pg_temp.check((get_attempt_result((select id from t_att where k='a1'))->'review'->0->>'explanation') is not null
   or (get_attempt_result((select id from t_att where k='a1'))->'review')::text like '%Geser 5%', 'pembahasan dikirim saat diizinkan');
reset role;

-- Guru mereset percobaan siswa (mis. kendala teknis)
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
select reset_quiz_attempt((select id from t_att where k='a2'));
reset role;
select pg_temp.check((select count(*) from audit_logs where action = 'quiz_attempts.reset') = 1, 'reset percobaan tercatat di audit log');
select pg_temp.check((select count(*) from audit_logs where action = 'quiz_answers.grade') = 1, 'penilaian esai tercatat di audit log');
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');
select pg_temp.check(start_quiz_attempt('95000000-0000-0000-0000-000000000001') is not null, 'setelah direset, siswa bisa mengerjakan lagi');
reset role;

-- Fungsi internal tidak bisa dipanggil pengguna
select pg_temp.login('00000000-0000-0000-0000-0000000005c1');
select pg_temp.expect_error($$select finalize_attempt((select id from t_att where k='b1'), false)$$, 'fungsi internal penilaian tidak bisa dipanggil langsung');
reset role;

-- Hapus kuis: percobaan & jawaban ikut terhapus
select pg_temp.login('00000000-0000-0000-0000-0000000005b1');
delete from quizzes where id = '95000000-0000-0000-0000-000000000003';
select pg_temp.check(not exists (select 1 from quiz_attempts where quiz_id = '95000000-0000-0000-0000-000000000003'), 'menghapus kuis menghapus percobaannya');
reset role;
rollback;
