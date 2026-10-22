-- Uji RLS & aturan Tahap 6 (notifikasi, pengumuman, forum, kalender, badge). Jalankan setelah stub + migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000006a1','adm6@lms.test','{"username":"adm6","full_name":"Admin Enam"}','{"roles":["admin"]}'),
 ('00000000-0000-0000-0000-0000000006b1','gr61@lms.test','{"username":"gr61","full_name":"Guru IPS"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000006b2','gr62@lms.test','{"username":"gr62","full_name":"Wali Kelas"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000006b3','gr63@lms.test','{"username":"gr63","full_name":"Guru Lain"}','{"roles":["teacher"]}'),
 ('00000000-0000-0000-0000-0000000006c1','6600000001@lms.test','{"username":"6600000001","full_name":"Siswa A"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000006c2','6600000002@lms.test','{"username":"6600000002","full_name":"Siswa B"}','{"roles":["student"]}'),
 ('00000000-0000-0000-0000-0000000006c3','6600000003@lms.test','{"username":"6600000003","full_name":"Siswa Lain"}','{"roles":["student"]}');
insert into teachers (id, profile_id) values
 ('16000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000006b1'),
 ('16000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000006b2'),
 ('16000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000006b3');
insert into students (id, profile_id, nisn, gender) values
 ('26000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000006c1','6600000001','P'),
 ('26000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000006c2','6600000002','L'),
 ('26000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000006c3','6600000003','L');

create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;
create or replace function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'GAGAL: % — tidak ada error', msg;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select admin_create_academic_year('2060/2061','2060-07-15','2061-06-30');
select set_active_semester((select s.id from semesters s join academic_years y on y.id = s.academic_year_id where y.name = '2060/2061' and s.number = 1));
insert into classes (id, academic_year_id, grade, name) values
 ('36000000-0000-0000-0000-00000000000a', active_academic_year_id(), 9, 'IX-X'),
 ('36000000-0000-0000-0000-00000000000b', active_academic_year_id(), 9, 'IX-Y');
insert into subjects (id, code, name) values ('46000000-0000-0000-0000-000000000001','IPS6','IPS');
select enroll_students('36000000-0000-0000-0000-00000000000a', array['26000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000002']::uuid[]);
select enroll_students('36000000-0000-0000-0000-00000000000b', array['26000000-0000-0000-0000-000000000003']::uuid[]);
insert into teaching_assignments (id, teacher_id, class_id, subject_id, semester_id) values
 ('56000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-00000000000a','46000000-0000-0000-0000-000000000001', active_semester_id()),
 ('56000000-0000-0000-0000-000000000002','16000000-0000-0000-0000-000000000003','36000000-0000-0000-0000-00000000000b','46000000-0000-0000-0000-000000000001', active_semester_id());
insert into class_guardians (class_id, teacher_id, semester_id) values ('36000000-0000-0000-0000-00000000000a','16000000-0000-0000-0000-000000000002', active_semester_id());
reset role;

-- =====================================================================
-- NOTIFIKASI dari materi, tugas, nilai, kuis
-- =====================================================================
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
insert into lessons (id, teaching_assignment_id, title, status, content_html) values
 ('66000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000001','Peta Indonesia','draft','<p>x</p>');
update lessons set status = 'published' where id = '66000000-0000-0000-0000-000000000001';
update lessons set status = 'draft' where id = '66000000-0000-0000-0000-000000000001';
update lessons set status = 'published' where id = '66000000-0000-0000-0000-000000000001';
insert into assignments (id, teaching_assignment_id, title, submission_types, start_at, due_at, status, description) values
 ('76000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000001','Tugas peta', array['text'], now() - interval '1 hour', now() + interval '12 hours', 'published', 'x'),
 ('76000000-0000-0000-0000-000000000002','56000000-0000-0000-0000-000000000001','Tugas minggu depan', array['text'], now() + interval '2 days', now() + interval '9 days', 'published', 'x');
reset role;
select pg_temp.check((select count(*) from notifications where type = 'material') = 2, 'materi terbit → notifikasi ke 2 siswa kelas (sekali saja walau diterbitkan ulang)');
select pg_temp.check(not exists (select 1 from notifications where user_id in ('00000000-0000-0000-0000-0000000006c3','00000000-0000-0000-0000-0000000006b1')), 'siswa kelas lain & guru pembuat tidak menerima notifikasi');

select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
select pg_temp.check((select count(*) from notifications where type = 'assignment') = 1, 'notifikasi tugas yang belum dimulai belum terlihat (terjadwal)');
select pg_temp.check((select count(*) from get_my_notifications() where type = 'deadline') = 1, 'pengingat tenggat H-1 dibuat saat siswa membuka notifikasi');
select pg_temp.check((select count(*) from get_my_notifications() where type = 'deadline') = 1, 'pengingat tidak dibuat ganda');
select pg_temp.check((select unread_total from get_my_notifications() limit 1) = 3, 'jumlah belum dibaca = 3');
select pg_temp.expect_error($$insert into notifications (user_id, type, title) values ('00000000-0000-0000-0000-0000000006c1','badge','Palsu')$$, 'siswa tidak bisa membuat notifikasi sendiri');
select pg_temp.expect_error($$update notifications set read_at = now()$$, 'siswa tidak bisa mengubah tabel notifikasi langsung');
select pg_temp.check(mark_notifications_read(array[(select max(id) from notifications)]) = 1, 'menandai satu notifikasi dibaca');
select pg_temp.check(mark_notifications_read() = 2, 'menandai semua notifikasi dibaca');
select pg_temp.expect_error($$select notify_users(array['00000000-0000-0000-0000-0000000006c2'::uuid], 'badge', 'x', null, null, null)$$, 'fungsi fan-out internal tidak bisa dipanggil langsung');
select save_submission('76000000-0000-0000-0000-000000000001', 'submit', 'Jawaban');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c2');
select pg_temp.check((select count(*) from get_my_notifications() where type = 'deadline') = 1, 'siswa B juga mendapat pengingat');
select pg_temp.check((select count(*) from notifications where user_id = '00000000-0000-0000-0000-0000000006c1') = 0, 'siswa tidak melihat notifikasi orang lain');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
insert into assignment_grades (assignment_id, student_id, score) values ('76000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001', 100);
select publish_grades('76000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.check((select count(*) from notifications where type = 'grade' and user_id = '00000000-0000-0000-0000-0000000006c1') = 1, 'nilai terbit → notifikasi ke siswa yang dinilai');

-- Preferensi sekolah: materi dimatikan
update school_settings set notification_prefs = notification_prefs || '{"new_material": false}';
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
insert into lessons (teaching_assignment_id, title, status, content_html) values ('56000000-0000-0000-0000-000000000001','Materi senyap','published','<p>x</p>');
reset role;
select pg_temp.check((select count(*) from notifications where type = 'material') = 2, 'notifikasi materi tidak dikirim bila dimatikan admin');
update school_settings set notification_prefs = notification_prefs || '{"new_material": true}';

-- =====================================================================
-- PENGUMUMAN
-- =====================================================================
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
select pg_temp.expect_error($$insert into announcements (scope, title) values ('school','Bukan admin')$$, 'guru biasa tidak bisa membuat pengumuman sekolah');
select pg_temp.expect_error($$insert into announcements (scope, class_id, title) values ('class','36000000-0000-0000-0000-00000000000a','Bukan wali')$$, 'guru bukan wali tidak bisa membuat pengumuman kelas');
insert into announcements (id, scope, teaching_assignment_id, title, body_html) values
 ('86000000-0000-0000-0000-000000000003','course','56000000-0000-0000-0000-000000000001','Bawa atlas','<p>Besok bawa atlas.</p>');
select pg_temp.expect_error($$insert into announcements (scope, teaching_assignment_id, title) values ('course','56000000-0000-0000-0000-000000000002','Kelas orang')$$, 'guru tidak bisa mengumumkan di ruang kelas guru lain');
select pg_temp.check((select count(*) from get_announcement_targets()) = 1, 'target pengumuman guru: hanya ruang kelasnya');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
insert into announcements (id, scope, class_id, title) values ('86000000-0000-0000-0000-000000000002','class','36000000-0000-0000-0000-00000000000a','Piket kelas');
select pg_temp.expect_error($$insert into announcements (scope, class_id, title) values ('class','36000000-0000-0000-0000-00000000000b','Kelas lain')$$, 'wali kelas hanya mengumumkan ke kelas binaannya');
select pg_temp.expect_error($$update announcements set scope = 'school', class_id = null where id = '86000000-0000-0000-0000-000000000002'$$, 'cakupan pengumuman tidak bisa diubah');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
insert into announcements (id, scope, title, is_pinned) values ('86000000-0000-0000-0000-000000000001','school','Libur semester', true);
insert into announcements (id, scope, title, publish_at) values ('86000000-0000-0000-0000-000000000004','school','Terjadwal', now() + interval '2 days');
insert into announcements (id, scope, title, publish_at, expires_at) values ('86000000-0000-0000-0000-000000000005','school','Kedaluwarsa', now() - interval '3 days', now() - interval '1 day');
select pg_temp.check((select count(*) from get_announcement_targets() where scope = 'class') = 2, 'admin bisa menargetkan semua kelas aktif');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
select pg_temp.check((select count(*) from get_announcements()) = 3, 'siswa A melihat 3 pengumuman (sekolah, kelas, mapel)');
select pg_temp.check((select title from get_announcements() limit 1) = 'Libur semester', 'pengumuman disematkan tampil paling atas');
select pg_temp.check(not exists (select 1 from announcements where title in ('Terjadwal','Kedaluwarsa')), 'pengumuman terjadwal & kedaluwarsa tidak terlihat siswa');
select pg_temp.check((select count(*) from notifications where type = 'announcement') = 3, 'notifikasi pengumuman terjadwal belum tampil');
select pg_temp.expect_error($$insert into announcements (scope, teaching_assignment_id, title) values ('course','56000000-0000-0000-0000-000000000001','Siswa')$$, 'siswa tidak bisa membuat pengumuman');
select pg_temp.check((select count(*) from get_announcements('56000000-0000-0000-0000-000000000001')) = 2, 'filter ruang kelas: pengumuman mapel + kelas');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c3');
select pg_temp.check((select count(*) from get_announcements()) = 1, 'siswa kelas lain hanya melihat pengumuman sekolah');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select pg_temp.check((select count(*) from get_announcements(null, true)) = 5, 'admin melihat semua termasuk terjadwal & kedaluwarsa');
delete from announcements where id = '86000000-0000-0000-0000-000000000004';
reset role;
select pg_temp.check(not exists (select 1 from notifications where ref_id = '86000000-0000-0000-0000-000000000004'), 'menghapus pengumuman menghapus notifikasinya');
select pg_temp.check(exists (select 1 from audit_logs where action = 'announcements.delete'), 'penghapusan pengumuman tercatat di audit log');

-- =====================================================================
-- FORUM
-- =====================================================================
select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
insert into discussion_topics (id, teaching_assignment_id, title, body, is_pinned) values
 ('96000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000001','Apa itu garis khatulistiwa?','Saya bingung bagian ini.', true);
select pg_temp.check(not (select is_pinned from discussion_topics where id = '96000000-0000-0000-0000-000000000001'), 'siswa tidak bisa menyematkan topik sendiri');
select pg_temp.expect_error($$update discussion_topics set is_locked = true where id = '96000000-0000-0000-0000-000000000001'$$, 'siswa tidak bisa mengunci topik');
update discussion_topics set body = 'Saya bingung bagian garis lintang.' where id = '96000000-0000-0000-0000-000000000001';
select pg_temp.check((select edited_at is not null from discussion_topics where id = '96000000-0000-0000-0000-000000000001'), 'penulis bisa mengubah topiknya (ditandai diedit)');
reset role;
select pg_temp.check(exists (select 1 from notifications where type = 'forum' and user_id = '00000000-0000-0000-0000-0000000006b1'), 'topik baru dari siswa → notifikasi ke guru');

select pg_temp.login('00000000-0000-0000-0000-0000000006c3');
select pg_temp.check((select count(*) from discussion_topics) = 0, 'siswa kelas lain tidak melihat forum kelas ini');
select pg_temp.expect_error($$insert into discussion_topics (teaching_assignment_id, title, body) values ('56000000-0000-0000-0000-000000000001','Menyusup','x')$$, 'siswa kelas lain tidak bisa membuat topik');
select pg_temp.expect_error($$select get_topic('96000000-0000-0000-0000-000000000001')$$, 'siswa kelas lain tidak bisa membuka topik');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000006c2');
insert into discussion_replies (id, topic_id, body) values ('a6000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000001','Garis lintang 0 derajat.');
insert into discussion_replies (id, topic_id, parent_id, body) values ('a6000000-0000-0000-0000-000000000002','96000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001','Tambahan: membagi bumi utara-selatan.');
update discussion_topics set body = 'diubah orang lain' where id = '96000000-0000-0000-0000-000000000001';
select pg_temp.check((select body from discussion_topics where id = '96000000-0000-0000-0000-000000000001') <> 'diubah orang lain', 'siswa lain tidak bisa mengubah topik');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
insert into discussion_replies (id, topic_id, parent_id, body) values ('a6000000-0000-0000-0000-000000000003','96000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000002','Terima kasih!');
select pg_temp.check((select parent_id from discussion_replies where id = 'a6000000-0000-0000-0000-000000000003') = 'a6000000-0000-0000-0000-000000000001', 'balasan atas balasan menempel ke balasan utama (satu tingkat)');
select pg_temp.check((select reply_count from discussion_topics where id = '96000000-0000-0000-0000-000000000001') = 3, 'jumlah balasan diperbarui otomatis');
select pg_temp.check((select count(*) from notifications where type = 'forum') >= 1, 'penulis topik mendapat notifikasi balasan');
delete from discussion_topics where id = '96000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from discussion_topics where id = '96000000-0000-0000-0000-000000000001') = 1, 'topik yang sudah dibalas tidak bisa dihapus penulisnya');
reset role;

-- Wali kelas bisa ikut berdiskusi tetapi tidak memoderasi
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select pg_temp.check(jsonb_array_length(get_topic('96000000-0000-0000-0000-000000000001')->'replies') = 3, 'wali kelas membaca diskusi kelas binaan');
update discussion_replies set is_hidden = true where id = 'a6000000-0000-0000-0000-000000000001';
select pg_temp.check(not (select is_hidden from discussion_replies where id = 'a6000000-0000-0000-0000-000000000001'), 'wali kelas (bukan pengampu) tidak bisa menyembunyikan balasan');
reset role;

-- Guru memoderasi
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
update discussion_replies set is_hidden = true where id = 'a6000000-0000-0000-0000-000000000001';
update discussion_topics set is_pinned = true, is_locked = true where id = '96000000-0000-0000-0000-000000000001';
select pg_temp.check((select reply_count from discussion_topics where id = '96000000-0000-0000-0000-000000000001') = 2, 'balasan disembunyikan tidak dihitung');
select pg_temp.check((select (get_topic('96000000-0000-0000-0000-000000000001')->>'can_moderate')::boolean), 'guru pengampu dapat memoderasi');
reset role;
select pg_temp.check(exists (select 1 from audit_logs where action = 'discussion_replies.hide'), 'penyembunyian balasan tercatat di audit log');
select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
select pg_temp.check(jsonb_array_length(get_topic('96000000-0000-0000-0000-000000000001')->'replies') = 2, 'siswa lain tidak melihat balasan yang disembunyikan');
select pg_temp.expect_error($$insert into discussion_replies (topic_id, body) values ('96000000-0000-0000-0000-000000000001','Masih bisa?')$$, 'topik terkunci tidak bisa dibalas');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c2');
select pg_temp.check(jsonb_array_length(get_topic('96000000-0000-0000-0000-000000000001')->'replies') = 3, 'penulis masih melihat balasannya yang disembunyikan');
delete from discussion_replies where id = 'a6000000-0000-0000-0000-000000000002';
select pg_temp.check(not exists (select 1 from discussion_replies where id = 'a6000000-0000-0000-0000-000000000002'), 'siswa bisa menghapus balasannya sendiri walau topik terkunci');
reset role;

-- Batas kecepatan menulis
select pg_temp.login('00000000-0000-0000-0000-0000000006c2');
insert into discussion_topics (id, teaching_assignment_id, title, body) values ('96000000-0000-0000-0000-000000000002','56000000-0000-0000-0000-000000000001','Spam?','1');
insert into discussion_replies (topic_id, body) select '96000000-0000-0000-0000-000000000002', 'balas ' || g from generate_series(1, 4) g;
select pg_temp.expect_error($$insert into discussion_replies (topic_id, body) values ('96000000-0000-0000-0000-000000000002','terlalu cepat')$$, 'lebih dari 6 tulisan per menit ditolak');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
delete from discussion_topics where id = '96000000-0000-0000-0000-000000000002';
select pg_temp.check(not exists (select 1 from discussion_topics where id = '96000000-0000-0000-0000-000000000002'), 'guru bisa menghapus topik beserta balasannya');
reset role;
select pg_temp.check((select count(*) from audit_logs where action = 'discussion_replies.delete') = 0, 'balasan yang terhapus bersama topik tidak membanjiri audit log');

-- =====================================================================
-- KALENDER
-- =====================================================================
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
insert into calendar_events (scope, title, category, start_date, end_date) values ('school','Libur Maulid','holiday', current_date + 3, current_date + 3);
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
insert into calendar_events (scope, class_id, title, category, start_date, end_date) values ('class','36000000-0000-0000-0000-00000000000a','Kerja bakti kelas','activity', current_date + 5, current_date + 5);
select pg_temp.expect_error($$insert into calendar_events (scope, title, start_date, end_date) values ('school','Bukan admin', current_date, current_date)$$, 'wali kelas tidak bisa membuat agenda sekolah');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b1');
select pg_temp.expect_error($$insert into calendar_events (scope, class_id, title, start_date, end_date) values ('class','36000000-0000-0000-0000-00000000000a','Bukan wali', current_date, current_date)$$, 'guru bukan wali tidak bisa membuat agenda kelas');
select pg_temp.check((select count(*) from get_my_calendar(current_date, current_date + 14) where kind = 'assignment') = 2, 'kalender guru memuat tenggat tugasnya');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
select pg_temp.expect_error($$insert into calendar_events (scope, title, start_date, end_date) values ('school','Siswa', current_date, current_date)$$, 'siswa tidak bisa membuat agenda');
select pg_temp.check((select count(*) from get_my_calendar(current_date, current_date + 14) where kind = 'event') = 2, 'kalender siswa: agenda sekolah + kelas');
select pg_temp.check((select done from get_my_calendar(current_date, current_date + 14) where id = '76000000-0000-0000-0000-000000000001'), 'tugas yang sudah dikumpulkan ditandai selesai di kalender');
select pg_temp.expect_error($$select * from get_my_calendar(current_date, current_date + 100)$$, 'rentang kalender dibatasi');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c3');
select pg_temp.check((select count(*) from get_my_calendar(current_date, current_date + 14)) = 1, 'siswa kelas lain hanya melihat agenda sekolah');
reset role;

-- =====================================================================
-- BADGE
-- =====================================================================
insert into lesson_progress (lesson_id, student_id, teaching_assignment_id, status, completed_at)
values ('66000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000001','completed', now());
select pg_temp.login('00000000-0000-0000-0000-0000000006c1');
select pg_temp.check((select earned and is_new from get_my_achievements() where code = 'langkah_pertama'), 'badge Langkah Pertama diberikan');
select pg_temp.check((select earned from get_my_achievements() where code = 'nilai_sempurna'), 'badge Nilai Sempurna dari nilai tugas 100');
select pg_temp.check((select not earned and progress = 2 and target = 5 from get_my_achievements() where code = 'aktif_berdiskusi'), 'progres badge forum 2/5 (topik + balasan)');
select pg_temp.check((select count(*) from notifications where type = 'badge') = 2, 'notifikasi badge baru (sekali saja)');
select pg_temp.expect_error($$insert into student_achievements (student_id, achievement_code, semester_id) values ('26000000-0000-0000-0000-000000000001','rajin_belajar', active_semester_id())$$, 'siswa tidak bisa memberi badge sendiri');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006c2');
select pg_temp.check((select count(*) from student_achievements) = 0, 'siswa tidak melihat badge siswa lain');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000006b2');
select pg_temp.check((select count(*) from student_achievements) = 2, 'wali kelas melihat badge siswa kelas binaan');
select pg_temp.expect_error($$select * from get_my_achievements()$$, 'halaman badge hanya untuk siswa');
reset role;
rollback;
