-- =====================================================================
-- 0011 — Monitoring & laporan
-- Tahap 7 (Monitoring & Laporan)
--
--  * activity_events: log aktivitas ringan (diisi trigger) untuk grafik
--    keaktifan guru & siswa. Tidak bisa dibaca/ditulis langsung; hanya lewat RPC.
--  * Fungsi laporan (security definer) memeriksa hak akses di awal:
--      admin  → semua;  wali kelas → kelas binaan (lintas mapel);
--      guru   → ruang kelas yang diajar.
--  * Nilai yang dihitung untuk laporan kelas/siswa hanya nilai yang sudah
--    terbit (tugas) dan kuis yang sudah selesai dinilai.
-- =====================================================================

alter table public.school_settings
  add column if not exists kkm smallint not null default 75;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'school_settings_kkm') then
    alter table public.school_settings add constraint school_settings_kkm check (kkm between 0 and 100);
  end if;
end$$;

-- Kolom baru ikut dapat diubah admin dari halaman Pengaturan Sekolah (RLS tetap membatasi ke admin).
grant update (kkm) on public.school_settings to authenticated;

create or replace function public.school_kkm()
returns integer language sql stable security definer set search_path = ''
as $$ select coalesce((select kkm from public.school_settings limit 1), 75) $$;

-- =====================================================================
-- LOG AKTIVITAS
-- =====================================================================
create table if not exists public.activity_events (
  id                      bigint generated always as identity primary key,
  user_id                 uuid references public.profiles (id) on delete cascade,
  role                    text not null,          -- student | teacher | admin
  event_type              text not null,
  teaching_assignment_id  uuid references public.teaching_assignments (id) on delete cascade,
  ref_id                  uuid,
  created_at              timestamptz not null default now()
);
create index if not exists activity_events_created_idx on public.activity_events (created_at);
create index if not exists activity_events_user_idx on public.activity_events (user_id, created_at desc);
create index if not exists activity_events_ta_idx on public.activity_events (teaching_assignment_id, created_at);

alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon, authenticated;

create or replace function public.user_role_label(p_user uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.students where profile_id = p_user) then 'student'
    when exists (select 1 from public.teachers where profile_id = p_user) then 'teacher'
    else 'admin' end
$$;

create or replace function public.log_activity(p_user uuid, p_type text, p_ta uuid default null, p_ref uuid default null)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_user is null then return; end if;
  insert into public.activity_events (user_id, role, event_type, teaching_assignment_id, ref_id)
  values (p_user, public.user_role_label(p_user), p_type, p_ta, p_ref);
end;
$$;

create or replace function public.track_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  case tg_table_name
  when 'profiles' then
    if new.last_login_at is distinct from old.last_login_at then
      perform public.log_activity(new.id, 'login');
    end if;
  when 'lesson_progress' then
    if tg_op = 'INSERT' then
      perform public.log_activity((select profile_id from public.students where id = new.student_id), 'lesson_open', new.teaching_assignment_id, new.lesson_id);
    elsif new.last_viewed_at > old.last_viewed_at + interval '30 minutes' then
      perform public.log_activity((select profile_id from public.students where id = new.student_id), 'lesson_open', new.teaching_assignment_id, new.lesson_id);
    end if;
    if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
      perform public.log_activity((select profile_id from public.students where id = new.student_id), 'lesson_complete', new.teaching_assignment_id, new.lesson_id);
    end if;
  when 'assignment_submissions' then
    if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
      perform public.log_activity((select profile_id from public.students where id = new.student_id), 'task_submit', new.teaching_assignment_id, new.assignment_id);
    end if;
  when 'quiz_attempts' then
    if tg_op = 'INSERT' then
      perform public.log_activity((select profile_id from public.students where id = new.student_id), 'quiz_start', new.teaching_assignment_id, new.quiz_id);
    elsif new.status = 'submitted' and old.status is distinct from 'submitted' then
      perform public.log_activity((select profile_id from public.students where id = new.student_id), 'quiz_submit', new.teaching_assignment_id, new.quiz_id);
    end if;
  when 'discussion_topics' then
    perform public.log_activity(new.author_id, 'forum_post', new.teaching_assignment_id, new.id);
  when 'discussion_replies' then
    perform public.log_activity(new.author_id, 'forum_post', public.topic_ta(new.topic_id), new.id);
  when 'lessons' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      perform public.log_activity(coalesce(auth.uid(), new.created_by), 'lesson_publish', new.teaching_assignment_id, new.id);
    end if;
  when 'assignments' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      perform public.log_activity(coalesce(auth.uid(), new.created_by), 'task_publish', new.teaching_assignment_id, new.id);
    end if;
  when 'quizzes' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      perform public.log_activity(coalesce(auth.uid(), new.created_by), 'quiz_publish', new.teaching_assignment_id, new.id);
    end if;
  when 'assignment_grades' then
    if tg_op = 'INSERT' or new.score is distinct from old.score then
      perform public.log_activity(coalesce(auth.uid(), new.graded_by), 'grade', new.teaching_assignment_id, new.assignment_id);
    end if;
  when 'announcements' then
    perform public.log_activity(new.author_id, 'announcement', new.teaching_assignment_id, new.id);
  else
    null;
  end case;
  return null;
end;
$$;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('profiles', 'after update of last_login_at'),
    ('lesson_progress', 'after insert or update'),
    ('assignment_submissions', 'after insert or update of status'),
    ('quiz_attempts', 'after insert or update of status'),
    ('discussion_topics', 'after insert'),
    ('discussion_replies', 'after insert'),
    ('lessons', 'after insert or update of status'),
    ('assignments', 'after insert or update of status'),
    ('quizzes', 'after insert or update of status'),
    ('assignment_grades', 'after insert or update of score'),
    ('announcements', 'after insert')
  ) as t(tbl, evt)
  loop
    execute format('drop trigger if exists %1$s_activity on public.%1$s', r.tbl);
    execute format('create trigger %1$s_activity %2$s on public.%1$s for each row execute function public.track_activity()', r.tbl, r.evt);
  end loop;
end$$;

-- Isi awal dari data yang sudah ada (sekali, saat tabel masih kosong).
do $$
begin
  if exists (select 1 from public.activity_events) then return; end if;
  insert into public.activity_events (user_id, role, event_type, teaching_assignment_id, ref_id, created_at)
  select s.profile_id, 'student', 'lesson_open', lp.teaching_assignment_id, lp.lesson_id, lp.first_viewed_at
  from public.lesson_progress lp join public.students s on s.id = lp.student_id
  union all
  select s.profile_id, 'student', 'lesson_complete', lp.teaching_assignment_id, lp.lesson_id, lp.completed_at
  from public.lesson_progress lp join public.students s on s.id = lp.student_id where lp.completed_at is not null
  union all
  select s.profile_id, 'student', 'task_submit', x.teaching_assignment_id, x.assignment_id, x.submitted_at
  from public.assignment_submissions x join public.students s on s.id = x.student_id where x.submitted_at is not null
  union all
  select s.profile_id, 'student', 'quiz_submit', a.teaching_assignment_id, a.quiz_id, a.submitted_at
  from public.quiz_attempts a join public.students s on s.id = a.student_id where a.submitted_at is not null
  union all
  select l.created_by, 'teacher', 'lesson_publish', l.teaching_assignment_id, l.id, l.published_at
  from public.lessons l where l.published_at is not null and l.created_by is not null
  union all
  select a.created_by, 'teacher', 'task_publish', a.teaching_assignment_id, a.id, a.published_at
  from public.assignments a where a.published_at is not null and a.created_by is not null
  union all
  select g.graded_by, 'teacher', 'grade', g.teaching_assignment_id, g.assignment_id, g.graded_at
  from public.assignment_grades g where g.graded_by is not null;
  update public.activity_events e set role = public.user_role_label(e.user_id) where e.role = 'teacher';
end$$;

-- =====================================================================
-- HAK AKSES LAPORAN
-- =====================================================================
create or replace function public.can_report_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_admin() or public.guards_class(p_class_id) or public.teaches_class(p_class_id) $$;

-- Guru biasa hanya melihat baris mapel yang ia ajar; admin & wali kelas melihat semua mapel kelas.
create or replace function public.can_report_ta_in_class(p_ta_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_admin() or public.guards_class(p_class_id) or public.can_manage_ta(p_ta_id) $$;

-- =====================================================================
-- RINGKASAN SISWA × MAPEL (inti laporan kelas, wali kelas, laporan siswa)
-- =====================================================================
create or replace function public.class_student_summary(p_class_id uuid, p_semester_id uuid)
returns table (
  student_id uuid, teaching_assignment_id uuid,
  task_avg numeric, task_count integer, task_missing integer, task_total integer,
  quiz_avg numeric, quiz_count integer, quiz_missed integer,
  overall_avg numeric, lessons_done integer, lessons_total integer
)
language sql stable security definer set search_path = ''
as $$
  with tas as (
    select ta.id from public.teaching_assignments ta where ta.class_id = p_class_id and ta.semester_id = p_semester_id
  ),
  studs as (
    select e.student_id from public.class_enrollments e where e.class_id = p_class_id
  ),
  task_scores as (
    select g.student_id, a.teaching_assignment_id ta_id, g.score * 100.0 / nullif(a.max_score, 0) pct
    from public.assignment_grades g join public.assignments a on a.id = g.assignment_id
    where a.teaching_assignment_id in (select id from tas) and g.published_at is not null and a.status = 'published'
  ),
  quiz_scores as (
    select a.student_id, a.teaching_assignment_id ta_id, a.quiz_id, max(a.score_total * 100.0 / nullif(a.max_score, 0)) pct
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id and q.status = 'published'
    where a.teaching_assignment_id in (select id from tas) and a.status = 'submitted' and not a.needs_manual
    group by a.student_id, a.teaching_assignment_id, a.quiz_id
  ),
  all_scores as (
    select student_id, ta_id, pct from task_scores
    union all
    select student_id, ta_id, pct from quiz_scores
  )
  select st.student_id, t.id,
    (select round(avg(pct), 1) from task_scores x where x.student_id = st.student_id and x.ta_id = t.id),
    (select count(*)::int from task_scores x where x.student_id = st.student_id and x.ta_id = t.id),
    (select count(*)::int from public.assignments a
      where a.teaching_assignment_id = t.id and a.status = 'published' and a.due_at < now()
        and not exists (select 1 from public.assignment_submissions s where s.assignment_id = a.id and s.student_id = st.student_id and s.status = 'submitted')
        and not exists (select 1 from public.assignment_grades g where g.assignment_id = a.id and g.student_id = st.student_id)),
    (select count(*)::int from public.assignments a where a.teaching_assignment_id = t.id and a.status = 'published' and a.start_at <= now()),
    (select round(avg(pct), 1) from quiz_scores x where x.student_id = st.student_id and x.ta_id = t.id),
    (select count(*)::int from quiz_scores x where x.student_id = st.student_id and x.ta_id = t.id),
    (select count(*)::int from public.quizzes q
      where q.teaching_assignment_id = t.id and q.status = 'published' and q.close_at < now()
        and not exists (select 1 from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = st.student_id)),
    (select round(avg(pct), 1) from all_scores x where x.student_id = st.student_id and x.ta_id = t.id),
    (select count(*)::int from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id and l.status = 'published'
      where lp.student_id = st.student_id and lp.teaching_assignment_id = t.id and lp.status = 'completed'),
    (select count(*)::int from public.lessons l where l.teaching_assignment_id = t.id and l.status = 'published')
  from studs st cross join tas t
$$;

-- Laporan kelas: satu baris per siswa × mapel (frontend menyusun tabel silang).
create or replace function public.report_class_summary(p_class_id uuid)
returns table (
  student_id uuid, full_name text, nisn text, teaching_assignment_id uuid, subject_name text, subject_code text,
  teacher_name text, task_avg numeric, task_count integer, task_missing integer, task_total integer,
  quiz_avg numeric, quiz_count integer, quiz_missed integer, overall_avg numeric,
  lessons_done integer, lessons_total integer, kkm integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_report_class(p_class_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select s.student_id, p.full_name, st.nisn, s.teaching_assignment_id, sub.name, sub.code, tp.full_name,
         s.task_avg, s.task_count, s.task_missing, s.task_total, s.quiz_avg, s.quiz_count, s.quiz_missed,
         s.overall_avg, s.lessons_done, s.lessons_total, public.school_kkm()
  from public.class_student_summary(p_class_id, public.active_semester_id()) s
  join public.students st on st.id = s.student_id
  join public.profiles p on p.id = st.profile_id
  join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles tp on tp.id = t.profile_id
  where public.can_report_ta_in_class(s.teaching_assignment_id, p_class_id)
  order by p.full_name, sub.sort_order, sub.name;
end;
$$;

-- Kelas yang boleh dilaporkan pengguna ini (tahun pelajaran aktif).
create or replace function public.get_report_classes()
returns table (id uuid, name text, grade smallint, student_count integer, is_guardian boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.grade,
         (select count(*)::int from public.class_enrollments e where e.class_id = c.id),
         public.guards_class(c.id)
  from public.classes c
  where c.academic_year_id = public.active_academic_year_id() and public.can_report_class(c.id)
  order by c.grade, c.name
$$;

-- =====================================================================
-- REKAP NILAI SATU RUANG KELAS (guru): setiap tugas & kuis sebagai kolom
-- =====================================================================
create or replace function public.report_ta_grades(p_ta_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_class uuid;
begin
  select class_id into v_class from public.teaching_assignments where id = p_ta_id;
  if v_class is null or not public.can_monitor_ta(p_ta_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'kkm', public.school_kkm(),
    'columns', coalesce((
      select jsonb_agg(c order by c ->> 'date', c ->> 'title')
      from (
        select jsonb_build_object('id', a.id, 'kind', 'task', 'title', a.title, 'max', a.max_score, 'date', a.due_at) c
        from public.assignments a where a.teaching_assignment_id = p_ta_id and a.status = 'published'
        union all
        select jsonb_build_object('id', q.id, 'kind', 'quiz', 'title', q.title,
                 'max', (select coalesce(sum(coalesce(it.points_override, qq.points)), 0) from public.quiz_question_items it
                         join public.quiz_questions qq on qq.id = it.question_id where it.quiz_id = q.id),
                 'date', q.close_at)
        from public.quizzes q where q.teaching_assignment_id = p_ta_id and q.status = 'published'
      ) x
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id, 'full_name', p.full_name, 'nisn', st.nisn,
        'scores', coalesce((
          select jsonb_object_agg(k, v) from (
            select g.assignment_id::text k,
                   jsonb_build_object('score', g.score, 'pct', round(g.score * 100.0 / nullif(a.max_score, 0), 1),
                                      'published', g.published_at is not null) v
            from public.assignment_grades g join public.assignments a on a.id = g.assignment_id
            where g.student_id = st.id and a.teaching_assignment_id = p_ta_id and a.status = 'published'
            union all
            select a.quiz_id::text,
                   jsonb_build_object('score', max(a.score_total), 'pct', round(max(a.score_total * 100.0 / nullif(a.max_score, 0)), 1),
                                      'published', not bool_or(a.needs_manual))
            from public.quiz_attempts a
            where a.student_id = st.id and a.teaching_assignment_id = p_ta_id and a.status = 'submitted'
            group by a.quiz_id
          ) s
        ), '{}'::jsonb),
        'missing', (select count(*) from public.assignments a
                    where a.teaching_assignment_id = p_ta_id and a.status = 'published' and a.due_at < now()
                      and not exists (select 1 from public.assignment_submissions s where s.assignment_id = a.id and s.student_id = st.id and s.status = 'submitted')
                      and not exists (select 1 from public.assignment_grades g where g.assignment_id = a.id and g.student_id = st.id)))
        order by p.full_name)
      from public.class_enrollments e
      join public.students st on st.id = e.student_id
      join public.profiles p on p.id = st.profile_id
      where e.class_id = v_class
    ), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================
-- MONITORING
-- =====================================================================
-- Monitoring pembelajaran per ruang kelas (admin; guru/wali hanya miliknya).
create or replace function public.monitor_learning()
returns table (
  teaching_assignment_id uuid, class_id uuid, class_name text, grade smallint, subject_name text, subject_color text,
  teacher_name text, student_count integer, lessons_published integer, lessons_draft integer,
  tasks_published integer, quizzes_published integer, avg_completion numeric,
  active_students_7d integer, last_teacher_activity timestamptz, topics integer
)
language sql stable security definer set search_path = ''
as $$
  select ta.id, c.id, c.name, c.grade, sub.name, sub.color, tp.full_name,
    (select count(*)::int from public.class_enrollments e where e.class_id = c.id),
    (select count(*)::int from public.lessons l where l.teaching_assignment_id = ta.id and l.status = 'published'),
    (select count(*)::int from public.lessons l where l.teaching_assignment_id = ta.id and l.status = 'draft'),
    (select count(*)::int from public.assignments a where a.teaching_assignment_id = ta.id and a.status = 'published'),
    (select count(*)::int from public.quizzes q where q.teaching_assignment_id = ta.id and q.status = 'published'),
    (select round(100.0 * count(*) filter (where lp.status = 'completed')
                  / nullif((select count(*) from public.lessons l where l.teaching_assignment_id = ta.id and l.status = 'published')
                           * (select count(*) from public.class_enrollments e where e.class_id = c.id), 0), 1)
     from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id and l.status = 'published'
     where lp.teaching_assignment_id = ta.id),
    (select count(distinct ev.user_id)::int from public.activity_events ev
     where ev.teaching_assignment_id = ta.id and ev.role = 'student' and ev.created_at > now() - interval '7 days'),
    (select max(ev.created_at) from public.activity_events ev where ev.teaching_assignment_id = ta.id and ev.user_id = t.profile_id),
    (select count(*)::int from public.discussion_topics dt where dt.teaching_assignment_id = ta.id and not dt.is_hidden)
  from public.teaching_assignments ta
  join public.classes c on c.id = ta.class_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles tp on tp.id = t.profile_id
  where ta.semester_id = public.active_semester_id() and public.can_monitor_ta(ta.id)
  order by c.grade, c.name, sub.sort_order, sub.name
$$;

-- Monitoring tugas & pengumpulan (filter kelas opsional).
create or replace function public.monitor_assignments(p_class_id uuid default null)
returns table (
  id uuid, title text, teaching_assignment_id uuid, class_id uuid, class_name text, subject_name text, subject_color text,
  teacher_name text, start_at timestamptz, due_at timestamptz, allow_late boolean, student_count integer,
  submitted integer, late integer, graded integer, grades_published integer, missing integer, avg_pct numeric
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, ta.id, c.id, c.name, sub.name, sub.color, tp.full_name, a.start_at, a.due_at, a.allow_late,
    (select count(*)::int from public.class_enrollments e where e.class_id = c.id),
    (select count(*)::int from public.assignment_submissions s where s.assignment_id = a.id and s.status = 'submitted'),
    (select count(*)::int from public.assignment_submissions s where s.assignment_id = a.id and s.status = 'submitted' and s.is_late),
    (select count(*)::int from public.assignment_grades g where g.assignment_id = a.id),
    (select count(*)::int from public.assignment_grades g where g.assignment_id = a.id and g.published_at is not null),
    case when a.due_at < now() then
      (select count(*)::int from public.class_enrollments e
       where e.class_id = c.id
         and not exists (select 1 from public.assignment_submissions s where s.assignment_id = a.id and s.student_id = e.student_id and s.status = 'submitted')
         and not exists (select 1 from public.assignment_grades g where g.assignment_id = a.id and g.student_id = e.student_id))
    else 0 end,
    (select round(avg(g.score * 100.0 / nullif(a.max_score, 0)), 1) from public.assignment_grades g where g.assignment_id = a.id)
  from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  join public.classes c on c.id = ta.class_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles tp on tp.id = t.profile_id
  where a.status = 'published' and ta.semester_id = public.active_semester_id()
    and (p_class_id is null or c.id = p_class_id)
    and public.can_monitor_ta(ta.id)
  order by a.due_at desc
$$;

-- Daftar siswa kelas (wali kelas / admin) yang belum mengumpulkan satu tugas.
create or replace function public.assignment_missing_students(p_assignment_id uuid)
returns table (student_id uuid, full_name text, nisn text, submission_status text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ta uuid;
begin
  select teaching_assignment_id into v_ta from public.assignments where id = p_assignment_id;
  if v_ta is null or not public.can_monitor_ta(v_ta) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select st.id, p.full_name, st.nisn, coalesce(s.status::text, 'none')
  from public.teaching_assignments ta
  join public.class_enrollments e on e.class_id = ta.class_id
  join public.students st on st.id = e.student_id
  join public.profiles p on p.id = st.profile_id
  left join public.assignment_submissions s on s.assignment_id = p_assignment_id and s.student_id = st.id
  where ta.id = v_ta and coalesce(s.status::text, 'none') <> 'submitted'
    and not exists (select 1 from public.assignment_grades g where g.assignment_id = p_assignment_id and g.student_id = st.id)
  order by p.full_name;
end;
$$;

-- =====================================================================
-- SISWA PERLU TINDAK LANJUT (wali kelas / admin)
-- =====================================================================
create or replace function public.class_followups(p_class_id uuid)
returns table (
  student_id uuid, full_name text, nisn text, overall_avg numeric, below_kkm_subjects text[],
  missing_tasks integer, missed_quizzes integer, progress_pct numeric, last_activity_at timestamptz,
  reasons text[], severity integer
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_kkm integer := public.school_kkm();
begin
  if not (public.is_admin() or public.guards_class(p_class_id)) then
    raise exception 'Hanya wali kelas atau admin.' using errcode = '42501';
  end if;
  return query
  with s as (select * from public.class_student_summary(p_class_id, public.active_semester_id())),
  agg as (
    select s.student_id,
      round(avg(s.overall_avg), 1) avg_all,
      array_agg(sub.name order by sub.name) filter (where s.overall_avg < v_kkm) below,
      sum(s.task_missing)::int missing,
      sum(s.quiz_missed)::int missed,
      round(100.0 * sum(s.lessons_done) / nullif(sum(s.lessons_total), 0), 1) prog
    from s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    join public.subjects sub on sub.id = ta.subject_id
    group by s.student_id
  ),
  base as (
    select a.*, st.nisn, p.full_name, p.id as profile_id,
      (select max(ev.created_at) from public.activity_events ev where ev.user_id = p.id) last_act
    from agg a
    join public.students st on st.id = a.student_id
    join public.profiles p on p.id = st.profile_id
  ),
  flagged as (
    select b.*,
      array_remove(array[
        case when b.missing >= 2 then b.missing || ' tugas lewat tenggat belum dikumpulkan' end,
        case when b.missing = 1 then '1 tugas lewat tenggat belum dikumpulkan' end,
        case when coalesce(cardinality(b.below), 0) > 0 then 'Nilai di bawah KKM (' || v_kkm || '): ' || array_to_string(b.below, ', ') end,
        case when b.missed > 0 then b.missed || ' kuis tidak dikerjakan' end,
        case when b.prog is not null and b.prog < 50 then 'Penyelesaian materi baru ' || round(b.prog)::int || '%' end,
        case when b.last_act is null then 'Belum pernah aktif di LMS'
             when b.last_act < now() - interval '7 days' then 'Tidak aktif sejak ' || to_char(b.last_act at time zone 'Asia/Jakarta', 'DD/MM/YYYY') end
      ], null) rs
    from base b
  )
  select f.student_id, f.full_name, f.nisn, f.avg_all, coalesce(f.below, '{}'), f.missing, f.missed, f.prog, f.last_act,
         f.rs,
         (case when f.missing >= 2 then 2 when f.missing = 1 then 1 else 0 end
          + least(coalesce(cardinality(f.below), 0), 3)
          + case when f.missed > 0 then 1 else 0 end
          + case when f.prog is not null and f.prog < 50 then 1 else 0 end
          + case when f.last_act is null or f.last_act < now() - interval '7 days' then 2 else 0 end)::int
  from flagged f
  order by 11 desc, f.full_name;
end;
$$;

-- =====================================================================
-- AKTIVITAS (grafik)
-- =====================================================================
-- Ringkasan harian. Cakupan: sekolah (admin), kelas (admin/wali), atau ruang kelas (pengelola/pemantau).
create or replace function public.activity_daily(p_days integer default 30, p_class_id uuid default null, p_ta_id uuid default null)
returns table (day date, student_events integer, teacher_events integer, active_students integer, active_teachers integer)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
begin
  if p_ta_id is not null then
    if not public.can_monitor_ta(p_ta_id) then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  elsif p_class_id is not null then
    if not (public.is_admin() or public.guards_class(p_class_id)) then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  elsif not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  -- Pembersihan log lama (> 400 hari) — murah karena memakai indeks waktu.
  delete from public.activity_events where created_at < now() - interval '400 days';

  return query
  with d as (
    select generate_series((now() at time zone 'Asia/Jakarta')::date - (v_days - 1), (now() at time zone 'Asia/Jakarta')::date, interval '1 day')::date as day
  ),
  ev as (
    select (e.created_at at time zone 'Asia/Jakarta')::date as day, e.role, e.user_id
    from public.activity_events e
    where e.created_at >= now() - make_interval(days => v_days + 1)
      and e.event_type <> 'login'
      and (p_ta_id is null or e.teaching_assignment_id = p_ta_id)
      and (p_class_id is null or e.teaching_assignment_id in (
            select ta.id from public.teaching_assignments ta where ta.class_id = p_class_id))
  )
  select d.day,
    (select count(*)::int from ev where ev.day = d.day and ev.role = 'student'),
    (select count(*)::int from ev where ev.day = d.day and ev.role = 'teacher'),
    (select count(distinct ev.user_id)::int from ev where ev.day = d.day and ev.role = 'student'),
    (select count(distinct ev.user_id)::int from ev where ev.day = d.day and ev.role = 'teacher')
  from d order by d.day;
end;
$$;

-- Keaktifan guru (admin): konten yang diterbitkan & penilaian dalam rentang waktu.
create or replace function public.teacher_activity(p_days integer default 30)
returns table (
  teacher_id uuid, full_name text, nip text, classes integer, lessons integer, tasks integer, quizzes integer,
  grades integer, forum integer, last_active_at timestamptz, last_login_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select t.id, p.full_name, t.nip,
    (select count(*)::int from public.teaching_assignments ta where ta.teacher_id = t.id and ta.semester_id = public.active_semester_id()),
    (select count(*)::int from public.activity_events e where e.user_id = p.id and e.event_type = 'lesson_publish' and e.created_at >= v_from),
    (select count(*)::int from public.activity_events e where e.user_id = p.id and e.event_type = 'task_publish' and e.created_at >= v_from),
    (select count(*)::int from public.activity_events e where e.user_id = p.id and e.event_type = 'quiz_publish' and e.created_at >= v_from),
    (select count(*)::int from public.activity_events e where e.user_id = p.id and e.event_type = 'grade' and e.created_at >= v_from),
    (select count(*)::int from public.activity_events e where e.user_id = p.id and e.event_type in ('forum_post', 'announcement') and e.created_at >= v_from),
    (select max(e.created_at) from public.activity_events e where e.user_id = p.id and e.event_type <> 'login'),
    p.last_login_at
  from public.teachers t
  join public.profiles p on p.id = t.profile_id and p.is_active
  order by p.full_name;
end;
$$;

-- =====================================================================
-- LAPORAN SATU SISWA
-- =====================================================================
create or replace function public.get_student_report(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_class uuid;
  v_sem uuid := public.active_semester_id();
begin
  select e.class_id into v_class
  from public.class_enrollments e where e.student_id = p_student_id and e.academic_year_id = public.active_academic_year_id();
  if v_class is null or not (public.is_admin() or public.can_view_student(p_student_id)) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'student', (select jsonb_build_object('id', st.id, 'full_name', p.full_name, 'nisn', st.nisn, 'nis', st.nis, 'gender', st.gender,
                                          'parent_name', st.parent_name, 'parent_phone', case when public.is_admin() or public.guards_class(v_class) then st.parent_phone end,
                                          'last_login_at', p.last_login_at)
                from public.students st join public.profiles p on p.id = st.profile_id where st.id = p_student_id),
    'class', (select jsonb_build_object('id', c.id, 'name', c.name) from public.classes c where c.id = v_class),
    'kkm', public.school_kkm(),
    'last_activity_at', (select max(ev.created_at) from public.activity_events ev
                         where ev.user_id = (select profile_id from public.students where id = p_student_id)),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'teaching_assignment_id', s.teaching_assignment_id, 'subject_name', sub.name, 'subject_color', sub.color,
               'teacher_name', tp.full_name, 'task_avg', s.task_avg, 'task_count', s.task_count, 'task_missing', s.task_missing,
               'task_total', s.task_total, 'quiz_avg', s.quiz_avg, 'quiz_count', s.quiz_count, 'quiz_missed', s.quiz_missed,
               'overall_avg', s.overall_avg, 'lessons_done', s.lessons_done, 'lessons_total', s.lessons_total)
             order by sub.sort_order, sub.name)
      from public.class_student_summary(v_class, v_sem) s
      join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
      join public.subjects sub on sub.id = ta.subject_id
      join public.teachers t on t.id = ta.teacher_id
      join public.profiles tp on tp.id = t.profile_id
      where s.student_id = p_student_id and public.can_report_ta_in_class(s.teaching_assignment_id, v_class)
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'title', a.title, 'subject_name', sub.name, 'due_at', a.due_at,
               'status', case when g.published_at is not null then 'graded'
                              when s.status = 'submitted' then case when s.is_late then 'late' else 'submitted' end
                              when a.due_at < now() then 'missing' else 'pending' end,
               'score', case when g.published_at is not null then round(g.score * 100.0 / nullif(a.max_score, 0), 1) end)
             order by a.due_at desc)
      from public.assignments a
      join public.teaching_assignments ta on ta.id = a.teaching_assignment_id and ta.class_id = v_class and ta.semester_id = v_sem
      join public.subjects sub on sub.id = ta.subject_id
      left join public.assignment_submissions s on s.assignment_id = a.id and s.student_id = p_student_id
      left join public.assignment_grades g on g.assignment_id = a.id and g.student_id = p_student_id
      where a.status = 'published' and a.start_at <= now() and public.can_report_ta_in_class(ta.id, v_class)
    ), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'subject_name', sub.name, 'close_at', q.close_at,
               'attempts', (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = p_student_id),
               'pct', (select round(max(a.score_total * 100.0 / nullif(a.max_score, 0)), 1) from public.quiz_attempts a
                       where a.quiz_id = q.id and a.student_id = p_student_id and a.status = 'submitted' and not a.needs_manual),
               'pending', exists (select 1 from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = p_student_id and a.needs_manual))
             order by q.open_at desc)
      from public.quizzes q
      join public.teaching_assignments ta on ta.id = q.teaching_assignment_id and ta.class_id = v_class and ta.semester_id = v_sem
      join public.subjects sub on sub.id = ta.subject_id
      where q.status = 'published' and q.open_at <= now() and public.can_report_ta_in_class(ta.id, v_class)
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'icon', a.icon, 'color', a.color, 'awarded_at', sa.awarded_at) order by a.position)
      from public.student_achievements sa join public.achievements a on a.code = sa.achievement_code
      where sa.student_id = p_student_id and sa.semester_id = v_sem
    ), '[]'::jsonb),
    'activity_14d', (select count(*) from public.activity_events ev
                     where ev.user_id = (select profile_id from public.students where id = p_student_id)
                       and ev.event_type <> 'login' and ev.created_at > now() - interval '14 days')
  );
end;
$$;

-- =====================================================================
-- Hak eksekusi
-- =====================================================================
do $$
declare f text;
begin
  foreach f in array array[
    'report_class_summary(uuid)', 'get_report_classes()', 'report_ta_grades(uuid)', 'monitor_learning()',
    'monitor_assignments(uuid)', 'assignment_missing_students(uuid)', 'class_followups(uuid)',
    'activity_daily(integer, uuid, uuid)', 'teacher_activity(integer)', 'get_student_report(uuid)', 'school_kkm()'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end$$;

revoke execute on function public.log_activity(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.track_activity() from public, anon, authenticated;
revoke execute on function public.class_student_summary(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.user_role_label(uuid) from public, anon, authenticated;
revoke execute on function public.can_report_class(uuid) from public, anon;
revoke execute on function public.can_report_ta_in_class(uuid, uuid) from public, anon;
grant execute on function public.can_report_class(uuid) to authenticated;
grant execute on function public.can_report_ta_in_class(uuid, uuid) to authenticated;
