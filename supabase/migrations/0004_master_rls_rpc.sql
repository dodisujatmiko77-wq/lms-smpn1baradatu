-- =====================================================================
-- 0004 — Hak akses (RLS), view direktori, dan RPC data master
-- Tahap 2 (Data Master)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fungsi helper (SECURITY DEFINER, dipakai RLS & RPC)
-- ---------------------------------------------------------------------

create or replace function public.active_semester_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.semesters where is_active limit 1 $$;

create or replace function public.active_academic_year_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select academic_year_id from public.semesters where is_active limit 1),
    (select id from public.academic_years where is_active limit 1)
  )
$$;

create or replace function public.current_teacher_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select t.id from public.teachers t join public.profiles p on p.id = t.profile_id
  where t.profile_id = auth.uid() and p.is_active
$$;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.id from public.students s join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid() and p.is_active
$$;

-- Guru mengajar di kelas ini (semester mana pun; kelas sudah terikat tahun pelajaran).
create or replace function public.teaches_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.teaching_assignments
    where class_id = p_class_id and teacher_id = public.current_teacher_id()
  )
$$;

-- Guru adalah wali kelas ini.
create or replace function public.guards_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_guardians
    where class_id = p_class_id and teacher_id = public.current_teacher_id()
  )
$$;

-- Siswa terdaftar di kelas ini.
create or replace function public.student_in_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_enrollments
    where class_id = p_class_id and student_id = public.current_student_id()
  )
$$;

-- Guru boleh melihat data siswa yang ia ajar / walikan pada tahun pelajaran aktif.
create or replace function public.can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_enrollments e
    where e.student_id = p_student_id
      and e.academic_year_id = public.active_academic_year_id()
      and (public.teaches_class(e.class_id) or public.guards_class(e.class_id))
  )
$$;

create or replace function public.can_view_student_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.profile_id = p_profile_id and public.can_view_student(s.id)
  )
$$;

-- Ruang kelas digital dapat dilihat oleh: admin, guru pengampu, wali kelas, siswa kelas tsb.
create or replace function public.can_view_ta(p_ta_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.teaching_assignments ta
    where ta.id = p_ta_id
      and (ta.teacher_id = public.current_teacher_id()
           or public.guards_class(ta.class_id)
           or public.student_in_class(ta.class_id))
  )
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.academic_years       enable row level security;
alter table public.semesters            enable row level security;
alter table public.teachers             enable row level security;
alter table public.students             enable row level security;
alter table public.classes              enable row level security;
alter table public.class_enrollments    enable row level security;
alter table public.subjects             enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.class_guardians      enable row level security;
alter table public.schedules            enable row level security;

-- Referensi umum (tidak sensitif): semua pengguna login boleh membaca; admin mengelola.
do $$
declare t text;
begin
  foreach t in array array['academic_years','semesters','subjects','classes']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true)', t);
  end loop;
end$$;

-- Penulisan seluruh data master hanya oleh admin.
do $$
declare t text;
begin
  foreach t in array array['academic_years','semesters','subjects','classes','teachers','students',
                           'class_enrollments','teaching_assignments','class_guardians','schedules']
  loop
    execute format('drop policy if exists %1$s_admin_write on public.%1$s', t);
    execute format('create policy %1$s_admin_write on public.%1$s for all to authenticated
                    using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end$$;

drop policy if exists teachers_select on public.teachers;
create policy teachers_select on public.teachers for select to authenticated
  using ((select public.is_admin()) or profile_id = (select auth.uid()));

drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated
  using ((select public.is_admin()) or profile_id = (select auth.uid()) or public.can_view_student(id));

drop policy if exists class_enrollments_select on public.class_enrollments;
create policy class_enrollments_select on public.class_enrollments for select to authenticated
  using (
    (select public.is_admin())
    or student_id = (select public.current_student_id())
    or public.teaches_class(class_id)
    or public.guards_class(class_id)
  );

drop policy if exists teaching_assignments_select on public.teaching_assignments;
create policy teaching_assignments_select on public.teaching_assignments for select to authenticated
  using (
    (select public.is_admin())
    or teacher_id = (select public.current_teacher_id())
    or public.guards_class(class_id)
    or public.student_in_class(class_id)
  );

drop policy if exists class_guardians_select on public.class_guardians;
create policy class_guardians_select on public.class_guardians for select to authenticated
  using (
    (select public.is_admin())
    or teacher_id = (select public.current_teacher_id())
    or public.teaches_class(class_id)
    or public.student_in_class(class_id)
  );

drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules for select to authenticated
  using (public.can_view_ta(teaching_assignment_id));

-- Guru & wali kelas boleh membaca profil siswa di kelasnya (tahun pelajaran aktif).
drop policy if exists profiles_select_teacher on public.profiles;
create policy profiles_select_teacher on public.profiles for select to authenticated
  using (public.can_view_student_profile(id));

-- Hak tabel: anon tidak punya akses sama sekali; authenticated dibatasi RLS.
revoke all on public.academic_years, public.semesters, public.teachers, public.students, public.classes,
  public.class_enrollments, public.subjects, public.teaching_assignments, public.class_guardians, public.schedules
  from anon;
grant select, insert, update, delete on public.academic_years, public.semesters, public.teachers, public.students,
  public.classes, public.class_enrollments, public.subjects, public.teaching_assignments, public.class_guardians,
  public.schedules to authenticated;

-- ---------------------------------------------------------------------
-- View direktori (security_invoker → tetap mengikuti RLS pemanggil)
-- ---------------------------------------------------------------------
create or replace view public.v_students
with (security_invoker = true) as
select
  s.id, s.profile_id, p.full_name, p.username, p.is_active, p.must_change_password, p.last_login_at,
  s.nisn, s.nis, s.gender, s.birth_place, s.birth_date, s.religion, s.address,
  s.parent_name, s.parent_phone, s.entry_year, s.status, s.created_at,
  e.class_id, c.name as class_name, c.grade
from public.students s
join public.profiles p on p.id = s.profile_id
left join public.class_enrollments e on e.student_id = s.id and e.academic_year_id = public.active_academic_year_id()
left join public.classes c on c.id = e.class_id;

create or replace view public.v_teachers
with (security_invoker = true) as
select
  t.id, t.profile_id, p.full_name, p.username, p.is_active, p.must_change_password, p.last_login_at, p.phone,
  p.contact_email, t.nip, t.nuptk, t.gender, t.birth_place, t.birth_date, t.employment_status, t.created_at,
  (select count(*) from public.teaching_assignments ta
    where ta.teacher_id = t.id and ta.semester_id = public.active_semester_id())::int as assignment_count,
  (select coalesce(sum(ta.hours_per_week), 0) from public.teaching_assignments ta
    where ta.teacher_id = t.id and ta.semester_id = public.active_semester_id())::int as hours_per_week,
  (select c.name from public.class_guardians g join public.classes c on c.id = g.class_id
    where g.teacher_id = t.id and g.semester_id = public.active_semester_id() limit 1) as guardian_class_name
from public.teachers t
join public.profiles p on p.id = t.profile_id;

revoke all on public.v_students, public.v_teachers from anon;
grant select on public.v_students, public.v_teachers to authenticated;

-- ---------------------------------------------------------------------
-- RPC admin
-- ---------------------------------------------------------------------

-- Membuat tahun pelajaran sekaligus semester Ganjil & Genap (satu transaksi).
create or replace function public.admin_create_academic_year(p_name text, p_start_date date, p_end_date date)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_split date;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat membuat tahun pelajaran' using errcode = '42501';
  end if;
  if p_end_date <= p_start_date then
    raise exception 'Tanggal selesai harus setelah tanggal mulai.' using errcode = '22023';
  end if;

  insert into public.academic_years (name, start_date, end_date) values (trim(p_name), p_start_date, p_end_date)
  returning id into v_id;

  -- Ganjil: awal TP s.d. 31 Desember; Genap: 1 Januari s.d. akhir TP (dapat diubah kemudian).
  v_split := make_date(extract(year from p_start_date)::int, 12, 31);
  if v_split <= p_start_date or v_split >= p_end_date then
    v_split := p_start_date + ((p_end_date - p_start_date) / 2);
  end if;

  insert into public.semesters (academic_year_id, number, start_date, end_date) values
    (v_id, 1, p_start_date, v_split),
    (v_id, 2, v_split + 1, p_end_date);

  return v_id;
end;
$$;

-- Mengaktifkan satu semester (dan tahun pelajarannya). Hanya satu yang aktif.
create or replace function public.set_active_semester(p_semester_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_year uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat mengubah semester aktif' using errcode = '42501';
  end if;
  select academic_year_id into v_year from public.semesters where id = p_semester_id;
  if v_year is null then
    raise exception 'Semester tidak ditemukan' using errcode = 'P0002';
  end if;

  update public.semesters set is_active = false where is_active and id <> p_semester_id;
  update public.academic_years set is_active = false where is_active and id <> v_year;
  update public.academic_years set is_active = true where id = v_year and not is_active;
  update public.semesters set is_active = true where id = p_semester_id and not is_active;
end;
$$;

-- Menempatkan / memindahkan siswa ke kelas (tahun pelajaran kelas tersebut).
create or replace function public.enroll_students(p_class_id uuid, p_student_ids uuid[])
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_year uuid;
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat menempatkan siswa' using errcode = '42501';
  end if;
  select academic_year_id into v_year from public.classes where id = p_class_id;
  if v_year is null then
    raise exception 'Kelas tidak ditemukan' using errcode = 'P0002';
  end if;

  insert into public.class_enrollments (class_id, student_id, academic_year_id)
  select p_class_id, sid, v_year from unnest(p_student_ids) as sid
  on conflict (student_id, academic_year_id) do update set class_id = excluded.class_id
  where public.class_enrollments.class_id is distinct from excluded.class_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Menyalin penugasan mengajar antar semester dalam tahun pelajaran yang sama (Ganjil → Genap).
create or replace function public.copy_teaching_assignments(p_from_semester uuid, p_to_semester uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat menyalin penugasan' using errcode = '42501';
  end if;
  if (select academic_year_id from public.semesters where id = p_from_semester)
     is distinct from (select academic_year_id from public.semesters where id = p_to_semester) then
    raise exception 'Penyalinan hanya dapat dilakukan antar semester dalam tahun pelajaran yang sama.' using errcode = '22023';
  end if;

  insert into public.teaching_assignments (teacher_id, class_id, subject_id, semester_id, hours_per_week)
  select teacher_id, class_id, subject_id, p_to_semester, hours_per_week
  from public.teaching_assignments where semester_id = p_from_semester
  on conflict (class_id, subject_id, semester_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Memperbarui data siswa + nama di profil dalam satu transaksi.
create or replace function public.admin_update_student(p_student_id uuid, p_data jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat mengubah data siswa' using errcode = '42501';
  end if;
  select profile_id into v_profile from public.students where id = p_student_id;
  if v_profile is null then
    raise exception 'Siswa tidak ditemukan' using errcode = 'P0002';
  end if;

  if p_data ? 'full_name' then
    update public.profiles set full_name = trim(p_data ->> 'full_name') where id = v_profile;
  end if;

  update public.students set
    nis          = case when p_data ? 'nis' then nullif(trim(p_data ->> 'nis'), '') else nis end,
    gender       = coalesce(p_data ->> 'gender', gender),
    birth_place  = case when p_data ? 'birth_place' then nullif(trim(p_data ->> 'birth_place'), '') else birth_place end,
    birth_date   = case when p_data ? 'birth_date' then nullif(p_data ->> 'birth_date', '')::date else birth_date end,
    religion     = case when p_data ? 'religion' then nullif(trim(p_data ->> 'religion'), '') else religion end,
    address      = case when p_data ? 'address' then nullif(trim(p_data ->> 'address'), '') else address end,
    parent_name  = case when p_data ? 'parent_name' then nullif(trim(p_data ->> 'parent_name'), '') else parent_name end,
    parent_phone = case when p_data ? 'parent_phone' then nullif(trim(p_data ->> 'parent_phone'), '') else parent_phone end,
    entry_year   = case when p_data ? 'entry_year' then nullif(p_data ->> 'entry_year', '')::smallint else entry_year end,
    status       = coalesce((p_data ->> 'status')::public.student_status, status)
  where id = p_student_id;
end;
$$;

-- Memperbarui data guru + nama/kontak di profil dalam satu transaksi.
create or replace function public.admin_update_teacher(p_teacher_id uuid, p_data jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat mengubah data guru' using errcode = '42501';
  end if;
  select profile_id into v_profile from public.teachers where id = p_teacher_id;
  if v_profile is null then
    raise exception 'Guru tidak ditemukan' using errcode = 'P0002';
  end if;

  update public.profiles set
    full_name     = case when p_data ? 'full_name' then trim(p_data ->> 'full_name') else full_name end,
    phone         = case when p_data ? 'phone' then nullif(trim(p_data ->> 'phone'), '') else phone end,
    contact_email = case when p_data ? 'contact_email' then nullif(trim(p_data ->> 'contact_email'), '') else contact_email end
  where id = v_profile;

  update public.teachers set
    nip               = case when p_data ? 'nip' then nullif(trim(p_data ->> 'nip'), '') else nip end,
    nuptk             = case when p_data ? 'nuptk' then nullif(trim(p_data ->> 'nuptk'), '') else nuptk end,
    gender            = case when p_data ? 'gender' then nullif(p_data ->> 'gender', '') else gender end,
    birth_place       = case when p_data ? 'birth_place' then nullif(trim(p_data ->> 'birth_place'), '') else birth_place end,
    birth_date        = case when p_data ? 'birth_date' then nullif(p_data ->> 'birth_date', '')::date else birth_date end,
    employment_status = case when p_data ? 'employment_status' then nullif(trim(p_data ->> 'employment_status'), '') else employment_status end
  where id = p_teacher_id;
end;
$$;

-- Statistik sekolah untuk dashboard admin.
create or replace function public.admin_school_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_sem uuid := public.active_semester_id();
  v_year uuid := public.active_academic_year_id();
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students_active', (select count(*) from public.students where status = 'active'),
    'teachers', (select count(*) from public.teachers),
    'classes', (select count(*) from public.classes where academic_year_id = v_year),
    'subjects', (select count(*) from public.subjects where is_active),
    'assignments', (select count(*) from public.teaching_assignments where semester_id = v_sem),
    'schedules', (select count(*) from public.schedules s join public.teaching_assignments ta on ta.id = s.teaching_assignment_id where ta.semester_id = v_sem),
    'enrolled', (select count(*) from public.class_enrollments where academic_year_id = v_year),
    'unplaced_students', (
      select count(*) from public.students s
      where s.status = 'active'
        and not exists (select 1 from public.class_enrollments e where e.student_id = s.id and e.academic_year_id = v_year)
    ),
    'classes_without_guardian', (
      select count(*) from public.classes c
      where c.academic_year_id = v_year
        and not exists (select 1 from public.class_guardians g where g.class_id = c.id and g.semester_id = v_sem)
    ),
    'has_active_semester', v_sem is not null
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC guru & siswa
-- ---------------------------------------------------------------------

-- Jadwal semester aktif milik pengguna (guru: yang ia ajar; siswa: kelasnya).
create or replace function public.get_my_schedule()
returns table (
  id uuid, day_of_week smallint, start_time time, end_time time, room text,
  teaching_assignment_id uuid, subject_name text, subject_code text, subject_color text,
  class_name text, teacher_name text
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.day_of_week, s.start_time, s.end_time, coalesce(s.room, c.room),
         ta.id, sub.name, sub.code, sub.color, c.name, p.full_name
  from public.schedules s
  join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.classes c on c.id = ta.class_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles p on p.id = t.profile_id
  where ta.semester_id = public.active_semester_id()
    and (
      ta.teacher_id = public.current_teacher_id()
      or ta.class_id in (select e.class_id from public.class_enrollments e where e.student_id = public.current_student_id())
    )
  order by s.day_of_week, s.start_time;
$$;

-- Kelas yang diajar guru pada semester aktif.
create or replace function public.get_my_teaching()
returns table (
  teaching_assignment_id uuid, class_id uuid, class_name text, grade smallint,
  subject_id uuid, subject_name text, subject_code text, subject_color text,
  hours_per_week smallint, student_count integer, schedule_count integer
)
language sql stable security definer set search_path = ''
as $$
  select ta.id, c.id, c.name, c.grade, sub.id, sub.name, sub.code, sub.color, ta.hours_per_week,
         (select count(*) from public.class_enrollments e where e.class_id = c.id)::int,
         (select count(*) from public.schedules s where s.teaching_assignment_id = ta.id)::int
  from public.teaching_assignments ta
  join public.classes c on c.id = ta.class_id
  join public.subjects sub on sub.id = ta.subject_id
  where ta.teacher_id = public.current_teacher_id()
    and ta.semester_id = public.active_semester_id()
  order by c.grade, c.name, sub.sort_order, sub.name;
$$;

-- Konteks pengguna (menggantikan versi Tahap 1): + data guru/siswa, wali kelas, semester aktif.
create or replace function public.get_my_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'full_name', p.full_name,
    'email', p.email,
    'contact_email', p.contact_email,
    'phone', p.phone,
    'avatar_path', p.avatar_path,
    'is_active', p.is_active,
    'must_change_password', p.must_change_password,
    'last_login_at', p.last_login_at,
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '[]'::jsonb),
    'teacher_id', (select t.id from public.teachers t where t.profile_id = p.id),
    'student_id', (select s.id from public.students s where s.profile_id = p.id),
    'guardian_class_ids', coalesce((
      select jsonb_agg(g.class_id)
      from public.class_guardians g join public.teachers t on t.id = g.teacher_id
      where t.profile_id = p.id and g.semester_id = public.active_semester_id()
    ), '[]'::jsonb),
    'student_class', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade)
      from public.students s
      join public.class_enrollments e on e.student_id = s.id and e.academic_year_id = public.active_academic_year_id()
      join public.classes c on c.id = e.class_id
      where s.profile_id = p.id
    ),
    'active_semester', (
      select jsonb_build_object('id', s.id, 'number', s.number, 'academic_year_id', y.id, 'academic_year', y.name)
      from public.semesters s join public.academic_years y on y.id = s.academic_year_id
      where s.is_active
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Hak eksekusi fungsi
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'active_semester_id()', 'active_academic_year_id()', 'current_teacher_id()', 'current_student_id()',
    'teaches_class(uuid)', 'guards_class(uuid)', 'student_in_class(uuid)', 'can_view_student(uuid)',
    'can_view_student_profile(uuid)', 'can_view_ta(uuid)',
    'admin_create_academic_year(text, date, date)', 'set_active_semester(uuid)', 'enroll_students(uuid, uuid[])',
    'copy_teaching_assignments(uuid, uuid)', 'admin_update_student(uuid, jsonb)', 'admin_update_teacher(uuid, jsonb)',
    'admin_school_stats()', 'get_my_schedule()', 'get_my_teaching()', 'get_my_context()'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end$$;

revoke execute on function public.enrollment_set_year() from public, anon, authenticated;
revoke execute on function public.check_class_semester_year() from public, anon, authenticated;
revoke execute on function public.check_schedule_conflict() from public, anon, authenticated;
