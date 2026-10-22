-- =====================================================================
-- 0012 — Pengerasan keamanan & optimasi indeks
-- Tahap 8 (Penyempurnaan)
--
-- Hasil audit (lihat supabase/tests/80_audit_keamanan.sql):
--  * Semua tabel public sudah RLS; semua fungsi SECURITY DEFINER mengunci search_path.
--  * Beberapa fungsi utilitas masih bisa dipanggil peran anon → dicabut.
--  * Kunci asing yang dipakai untuk filter, RLS, atau penghapusan berantai
--    belum berindeks → ditambahkan (mencegah scan penuh saat data membesar).
-- Migrasi ini aman dijalankan ulang dan tidak mengubah data.
-- =====================================================================

-- ---------- Hak eksekusi ----------
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.try_uuid(text) from public, anon;
revoke execute on function public.wib(timestamptz) from public, anon;
grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.wib(timestamptz) to authenticated;

-- Default ke depan: fungsi baru di schema public tidak otomatis bisa dipanggil anon.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------- Indeks ----------
-- CBT: daftar kuis siswa, laporan, & penghapusan soal/opsi.
create index if not exists quiz_attempts_student_idx on public.quiz_attempts (student_id, status);
create index if not exists quiz_attempts_ta_idx on public.quiz_attempts (teaching_assignment_id, status);
create index if not exists quiz_answers_question_idx on public.quiz_answers (question_id);
create index if not exists quiz_answers_option_idx on public.quiz_answers (selected_option_id) where selected_option_id is not null;
create index if not exists quiz_question_items_question_idx on public.quiz_question_items (question_id);
create index if not exists question_banks_subject_idx on public.question_banks (subject_id);

-- Data master & hak akses (can_view_student, laporan).
create index if not exists class_enrollments_year_idx on public.class_enrollments (academic_year_id, student_id);
create index if not exists teaching_assignments_subject_idx on public.teaching_assignments (subject_id);
create index if not exists teaching_assignments_semester_teacher_idx on public.teaching_assignments (semester_id, teacher_id);
create index if not exists class_guardians_semester_idx on public.class_guardians (semester_id, teacher_id);

-- Tugas
create index if not exists assignment_grades_submission_idx on public.assignment_grades (submission_id) where submission_id is not null;
create index if not exists assignment_grades_student_idx on public.assignment_grades (student_id, published_at);

-- Forum: batas kecepatan menulis, badge, balasan bertingkat.
create index if not exists discussion_topics_author_idx on public.discussion_topics (author_id, created_at desc);
create index if not exists discussion_replies_author_idx on public.discussion_replies (author_id, created_at desc);
create index if not exists discussion_replies_parent_idx on public.discussion_replies (parent_id) where parent_id is not null;

-- Pengumuman, kalender, badge, aktivitas.
create index if not exists announcements_author_idx on public.announcements (author_id);
create index if not exists calendar_events_class_idx on public.calendar_events (class_id) where class_id is not null;
create index if not exists student_achievements_semester_idx on public.student_achievements (semester_id);
create index if not exists activity_events_type_idx on public.activity_events (user_id, event_type, created_at desc);

-- Perbarui statistik perencana kueri.
analyze;

-- =====================================================================
-- Pembersihan berkas jawaban tugas semester lalu (hemat kuota Storage)
-- Nilai, umpan balik, jawaban teks, dan tautan TIDAK dihapus — hanya berkas unggahan.
-- =====================================================================
alter table public.assignment_submissions add column if not exists files_purged_at timestamptz;

-- Ringkasan berkas jawaban per semester (admin).
create or replace function public.admin_submission_files_by_semester()
returns table (semester_id uuid, label text, is_active boolean, ended boolean, submissions integer, files integer, total_bytes bigint, purged integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select s.id, y.name || ' ' || case s.number when 1 then 'Ganjil' else 'Genap' end, s.is_active, s.end_date < current_date,
         count(distinct sub.id) filter (where f.value is not null)::int,
         count(f.value)::int,
         coalesce(sum((f.value ->> 'size_bytes')::bigint), 0)::bigint,
         count(distinct sub.id) filter (where sub.files_purged_at is not null)::int
  from public.semesters s
  join public.academic_years y on y.id = s.academic_year_id
  join public.teaching_assignments ta on ta.semester_id = s.id
  join public.assignment_submissions sub on sub.teaching_assignment_id = ta.id
  left join lateral jsonb_array_elements(sub.files) f(value) on f.value ->> 'storage_path' is not null
  group by s.id, y.name, s.number, s.is_active, s.end_date, s.start_date
  order by s.start_date desc;
end;
$$;

-- Daftar path berkas jawaban satu semester yang sudah selesai (untuk dihapus dari Storage oleh aplikasi).
create or replace function public.admin_submission_file_paths(p_semester_id uuid)
returns text[]
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if exists (select 1 from public.semesters where id = p_semester_id and (is_active or end_date >= current_date)) then
    raise exception 'Semester aktif atau belum berakhir tidak dapat dibersihkan.' using errcode = '22023';
  end if;
  return coalesce((
    select array_agg(f ->> 'storage_path')
    from public.assignment_submissions sub
    join public.teaching_assignments ta on ta.id = sub.teaching_assignment_id and ta.semester_id = p_semester_id
    cross join lateral jsonb_array_elements(sub.files) f
    where f ->> 'storage_path' is not null
  ), '{}');
end;
$$;

-- Setelah berkas dihapus dari Storage: kosongkan daftar berkas & catat di audit log.
create or replace function public.admin_mark_submission_files_purged(p_semester_id uuid, p_files integer, p_bytes bigint)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if exists (select 1 from public.semesters where id = p_semester_id and (is_active or end_date >= current_date)) then
    raise exception 'Semester aktif atau belum berakhir tidak dapat dibersihkan.' using errcode = '22023';
  end if;
  update public.assignment_submissions sub set files = '[]'::jsonb, files_purged_at = now()
  from public.teaching_assignments ta
  where ta.id = sub.teaching_assignment_id and ta.semester_id = p_semester_id
    and jsonb_array_length(sub.files) > 0;
  get diagnostics v_n = row_count;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'storage.purge_submissions', 'semesters', p_semester_id::text,
          jsonb_build_object('submissions', v_n, 'files', p_files, 'bytes', p_bytes));
  return v_n;
end;
$$;

revoke execute on function public.admin_submission_files_by_semester() from public, anon;
revoke execute on function public.admin_submission_file_paths(uuid) from public, anon;
revoke execute on function public.admin_mark_submission_files_purged(uuid, integer, bigint) from public, anon;
grant execute on function public.admin_submission_files_by_semester() to authenticated;
grant execute on function public.admin_submission_file_paths(uuid) to authenticated;
grant execute on function public.admin_mark_submission_files_purged(uuid, integer, bigint) to authenticated;
