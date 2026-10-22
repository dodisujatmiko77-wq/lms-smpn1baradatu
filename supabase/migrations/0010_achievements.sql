-- =====================================================================
-- 0010 — Badge pencapaian siswa
-- Tahap 6 (Interaksi)
--
-- Badge dihitung per semester aktif dari data belajar yang sudah ada
-- (progress materi, pengumpulan tugas, kuis, forum). Penilaian dilakukan
-- server saat siswa membuka beranda/halaman badge — tidak perlu pg_cron.
-- Siswa tidak dapat menulis badge sendiri.
-- =====================================================================

create table if not exists public.achievements (
  code         text primary key,
  name         text not null,
  description  text not null,
  icon         text not null,       -- nama ikon Lucide
  color        text not null,
  target       integer not null check (target > 0),
  position     integer not null default 0
);

insert into public.achievements (code, name, description, icon, color, target, position) values
  ('langkah_pertama',  'Langkah Pertama',  'Menyelesaikan 1 pertemuan',                                    'Footprints',     '#0ea5e9', 1,  1),
  ('rajin_belajar',    'Rajin Belajar',    'Menyelesaikan 10 pertemuan dalam satu semester',               'BookOpenCheck',  '#2563eb', 10, 2),
  ('materi_tuntas',    'Materi Tuntas',    'Menuntaskan semua pertemuan di satu mata pelajaran (min. 3)',  'GraduationCap',  '#16a34a', 1,  3),
  ('tepat_waktu',      'Tepat Waktu',      'Mengumpulkan 5 tugas sebelum tenggat',                         'AlarmClockCheck','#f97316', 5,  4),
  ('pejuang_kuis',     'Pejuang Kuis',     'Mengerjakan 5 kuis atau ujian',                                'Swords',         '#7c3aed', 5,  5),
  ('nilai_sempurna',   'Nilai Sempurna',   'Mendapat nilai penuh pada tugas atau kuis',                    'Trophy',         '#eab308', 1,  6),
  ('aktif_berdiskusi', 'Aktif Berdiskusi', 'Menulis 5 topik atau balasan di forum diskusi',                'MessagesSquare', '#db2777', 5,  7)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  color = excluded.color, target = excluded.target, position = excluded.position;

create table if not exists public.student_achievements (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students (id) on delete cascade,
  achievement_code  text not null references public.achievements (code) on delete cascade,
  semester_id       uuid not null references public.semesters (id) on delete cascade,
  awarded_at        timestamptz not null default now(),
  constraint student_achievements_unique unique (student_id, achievement_code, semester_id)
);
create index if not exists student_achievements_student_idx on public.student_achievements (student_id, semester_id);

alter table public.achievements enable row level security;
alter table public.student_achievements enable row level security;
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to authenticated using (true);
drop policy if exists student_achievements_select on public.student_achievements;
create policy student_achievements_select on public.student_achievements for select to authenticated
  using (student_id = (select public.current_student_id()) or public.is_admin() or public.can_view_student(student_id));
revoke all on public.achievements, public.student_achievements from anon, authenticated;
grant select on public.achievements, public.student_achievements to authenticated;

-- Progres setiap badge untuk satu siswa pada satu semester.
create or replace function public.achievement_progress(p_student_id uuid, p_semester_id uuid)
returns table (code text, progress integer)
language sql stable security definer set search_path = ''
as $$
  with tas as (
    select ta.id from public.teaching_assignments ta
    join public.class_enrollments e on e.class_id = ta.class_id and e.student_id = p_student_id
    where ta.semester_id = p_semester_id
  ),
  done_lessons as (
    select count(*)::int n from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id and l.status = 'published'
    where lp.student_id = p_student_id and lp.status = 'completed' and lp.teaching_assignment_id in (select id from tas)
  ),
  complete_courses as (
    select count(*)::int n from tas
    where (select count(*) from public.lessons l where l.teaching_assignment_id = tas.id and l.status = 'published') >= 3
      and not exists (
        select 1 from public.lessons l
        where l.teaching_assignment_id = tas.id and l.status = 'published'
          and not exists (select 1 from public.lesson_progress lp
                          where lp.lesson_id = l.id and lp.student_id = p_student_id and lp.status = 'completed'))
  ),
  on_time as (
    select count(*)::int n from public.assignment_submissions s
    where s.student_id = p_student_id and s.status = 'submitted' and not s.is_late
      and s.teaching_assignment_id in (select id from tas)
  ),
  quizzes as (
    select count(distinct a.quiz_id)::int n from public.quiz_attempts a
    where a.student_id = p_student_id and a.status = 'submitted' and a.teaching_assignment_id in (select id from tas)
  ),
  perfect as (
    select ((select count(*) from public.quiz_attempts a
             where a.student_id = p_student_id and a.status = 'submitted' and not a.needs_manual
               and a.max_score > 0 and a.score_total >= a.max_score and a.teaching_assignment_id in (select id from tas))
          + (select count(*) from public.assignment_grades g join public.assignments asg on asg.id = g.assignment_id
             where g.student_id = p_student_id and g.published_at is not null and g.score >= asg.max_score
               and g.teaching_assignment_id in (select id from tas)))::int n
  ),
  posts as (
    select ((select count(*) from public.discussion_topics t
             where t.author_id = (select profile_id from public.students where id = p_student_id)
               and not t.is_hidden and t.teaching_assignment_id in (select id from tas))
          + (select count(*) from public.discussion_replies r join public.discussion_topics t on t.id = r.topic_id
             where r.author_id = (select profile_id from public.students where id = p_student_id)
               and not r.is_hidden and t.teaching_assignment_id in (select id from tas)))::int n
  )
  select 'langkah_pertama', (select n from done_lessons)
  union all select 'rajin_belajar', (select n from done_lessons)
  union all select 'materi_tuntas', (select n from complete_courses)
  union all select 'tepat_waktu', (select n from on_time)
  union all select 'pejuang_kuis', (select n from quizzes)
  union all select 'nilai_sempurna', (select n from perfect)
  union all select 'aktif_berdiskusi', (select n from posts)
$$;

-- Badge siswa yang sedang login: hitung, berikan yang baru tercapai, lalu tampilkan.
create or replace function public.get_my_achievements()
returns table (
  code text, name text, description text, icon text, color text, target integer,
  progress integer, earned boolean, awarded_at timestamptz, is_new boolean
)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_sem uuid := public.active_semester_id();
begin
  if v_student is null then
    raise exception 'Hanya untuk siswa.' using errcode = '42501';
  end if;
  if v_sem is null then
    return;
  end if;

  insert into public.student_achievements (student_id, achievement_code, semester_id)
  select v_student, a.code, v_sem
  from public.achievements a join public.achievement_progress(v_student, v_sem) p on p.code = a.code
  where p.progress >= a.target
  on conflict do nothing;

  -- Badge yang baru diberikan pada transaksi ini (awarded_at = now()) → notifikasi langsung,
  -- karena penerimanya adalah pengguna yang sedang login.
  insert into public.notifications (user_id, type, title, body, link, ref_id)
  select auth.uid(), 'badge', 'Badge baru: ' || a.name, a.description, '/siswa/pencapaian', sa.id
  from public.student_achievements sa
  join public.achievements a on a.code = sa.achievement_code
  where sa.student_id = v_student and sa.semester_id = v_sem and sa.awarded_at = now()
  on conflict do nothing;

  return query
  select a.code, a.name, a.description, a.icon, a.color, a.target,
         least(coalesce(p.progress, 0), a.target), sa.id is not null, sa.awarded_at,
         coalesce(sa.awarded_at = now(), false)
  from public.achievements a
  left join public.achievement_progress(v_student, v_sem) p on p.code = a.code
  left join public.student_achievements sa on sa.student_id = v_student and sa.achievement_code = a.code and sa.semester_id = v_sem
  order by a.position;
end;
$$;

revoke execute on function public.achievement_progress(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_my_achievements() from public, anon;
grant execute on function public.get_my_achievements() to authenticated;
