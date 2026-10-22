-- =====================================================================
-- 0003 — Data master akademik
-- Tahap 2 (Data Master)
--
-- Tahun pelajaran & semester, guru, siswa, kelas, penempatan siswa,
-- mata pelajaran, penugasan mengajar (= ruang kelas digital), wali kelas,
-- dan jadwal pelajaran. Semua data akademik terikat pada tahun pelajaran
-- dan/atau semester.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'student_status') then
    create type public.student_status as enum ('active', 'graduated', 'moved', 'dropped');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Tahun pelajaran & semester
-- ---------------------------------------------------------------------
create table if not exists public.academic_years (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                         -- contoh: 2026/2027
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint academic_years_name_format check (name ~ '^[0-9]{4}/[0-9]{4}$'),
  constraint academic_years_dates check (end_date > start_date)
);
create unique index if not exists academic_years_name_key on public.academic_years (name);
create unique index if not exists academic_years_one_active on public.academic_years (is_active) where is_active;

create table if not exists public.semesters (
  id                uuid primary key default gen_random_uuid(),
  academic_year_id  uuid not null references public.academic_years (id) on delete cascade,
  number            smallint not null,               -- 1 = Ganjil, 2 = Genap
  start_date        date not null,
  end_date          date not null,
  is_active         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint semesters_number check (number in (1, 2)),
  constraint semesters_dates check (end_date > start_date),
  constraint semesters_unique unique (academic_year_id, number)
);
create unique index if not exists semesters_one_active on public.semesters (is_active) where is_active;

-- ---------------------------------------------------------------------
-- Guru & siswa (data rinci; identitas login ada di profiles)
-- ---------------------------------------------------------------------
create table if not exists public.teachers (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null unique references public.profiles (id) on delete cascade,
  nip                text,
  nuptk              text,
  gender             char(1),
  birth_place        text,
  birth_date         date,
  employment_status  text,                            -- PNS / PPPK / Honorer / GTT
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint teachers_nip_format check (nip is null or nip ~ '^[0-9]{18}$'),
  constraint teachers_nuptk_format check (nuptk is null or nuptk ~ '^[0-9]{16}$'),
  constraint teachers_gender check (gender is null or gender in ('L', 'P'))
);
create unique index if not exists teachers_nip_key on public.teachers (nip) where nip is not null;
create unique index if not exists teachers_nuptk_key on public.teachers (nuptk) where nuptk is not null;

create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null unique references public.profiles (id) on delete cascade,
  nisn          text not null,
  nis           text,
  gender        char(1) not null,
  birth_place   text,
  birth_date    date,
  religion      text,
  address       text,
  parent_name   text,
  parent_phone  text,
  entry_year    smallint,
  status        public.student_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint students_nisn_format check (nisn ~ '^[0-9]{10}$'),
  constraint students_gender check (gender in ('L', 'P'))
);
create unique index if not exists students_nisn_key on public.students (nisn);
create unique index if not exists students_nis_key on public.students (nis) where nis is not null;
create index if not exists students_status_idx on public.students (status);

-- ---------------------------------------------------------------------
-- Kelas & penempatan siswa (per tahun pelajaran)
-- ---------------------------------------------------------------------
create table if not exists public.classes (
  id                uuid primary key default gen_random_uuid(),
  academic_year_id  uuid not null references public.academic_years (id) on delete restrict,
  grade             smallint not null,               -- 7, 8, 9
  name              text not null,                   -- contoh: VII-A
  room              text,
  capacity          smallint not null default 32,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint classes_grade check (grade between 7 and 9),
  constraint classes_capacity check (capacity between 1 and 60),
  constraint classes_name_len check (char_length(name) between 1 and 30),
  constraint classes_unique_name unique (academic_year_id, name)
);
create index if not exists classes_year_grade_idx on public.classes (academic_year_id, grade);

create table if not exists public.class_enrollments (
  id                uuid primary key default gen_random_uuid(),
  class_id          uuid not null references public.classes (id) on delete restrict,
  student_id        uuid not null references public.students (id) on delete cascade,
  academic_year_id  uuid not null references public.academic_years (id) on delete restrict,
  created_at        timestamptz not null default now(),
  constraint class_enrollments_one_per_year unique (student_id, academic_year_id)
);
create index if not exists class_enrollments_class_idx on public.class_enrollments (class_id);

-- ---------------------------------------------------------------------
-- Mata pelajaran
-- ---------------------------------------------------------------------
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  group_name  text not null default 'Umum',         -- Umum / Muatan Lokal / Pilihan
  color       text not null default '#1d4ed8',
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint subjects_code_format check (code ~ '^[A-Z0-9-]{2,12}$'),
  constraint subjects_color_format check (color ~ '^#[0-9a-fA-F]{6}$')
);
create unique index if not exists subjects_code_key on public.subjects (code);

-- ---------------------------------------------------------------------
-- Penugasan mengajar = RUANG KELAS DIGITAL (guru × kelas × mapel × semester)
-- ---------------------------------------------------------------------
create table if not exists public.teaching_assignments (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null references public.teachers (id) on delete restrict,
  class_id        uuid not null references public.classes (id) on delete restrict,
  subject_id      uuid not null references public.subjects (id) on delete restrict,
  semester_id     uuid not null references public.semesters (id) on delete restrict,
  hours_per_week  smallint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint teaching_assignments_unique unique (class_id, subject_id, semester_id),
  constraint teaching_assignments_hours check (hours_per_week is null or hours_per_week between 1 and 20)
);
create index if not exists teaching_assignments_teacher_idx on public.teaching_assignments (teacher_id, semester_id);
create index if not exists teaching_assignments_semester_idx on public.teaching_assignments (semester_id);

-- ---------------------------------------------------------------------
-- Wali kelas (per semester)
-- ---------------------------------------------------------------------
create table if not exists public.class_guardians (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes (id) on delete cascade,
  teacher_id   uuid not null references public.teachers (id) on delete restrict,
  semester_id  uuid not null references public.semesters (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint class_guardians_unique unique (class_id, semester_id)
);
create index if not exists class_guardians_teacher_idx on public.class_guardians (teacher_id, semester_id);

-- ---------------------------------------------------------------------
-- Jadwal pelajaran
-- ---------------------------------------------------------------------
create table if not exists public.schedules (
  id                      uuid primary key default gen_random_uuid(),
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  day_of_week             smallint not null,         -- 1 = Senin … 6 = Sabtu
  start_time              time not null,
  end_time                time not null,
  room                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint schedules_day check (day_of_week between 1 and 6),
  constraint schedules_time check (end_time > start_time)
);
create index if not exists schedules_ta_idx on public.schedules (teaching_assignment_id);
create index if not exists schedules_day_idx on public.schedules (day_of_week);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['academic_years','semesters','teachers','students','classes','subjects',
                           'teaching_assignments','class_guardians','schedules']
  loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_set_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------
-- Validasi lintas tabel (aturan yang tidak bisa diungkapkan dengan FK)
-- ---------------------------------------------------------------------

-- Penempatan siswa: tahun pelajaran diambil otomatis dari kelas.
create or replace function public.enrollment_set_year()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select c.academic_year_id into new.academic_year_id from public.classes c where c.id = new.class_id;
  return new;
end;
$$;

drop trigger if exists class_enrollments_set_year on public.class_enrollments;
create trigger class_enrollments_set_year before insert or update of class_id on public.class_enrollments
  for each row execute function public.enrollment_set_year();

-- Kelas dan semester pada penugasan/wali kelas harus berada di tahun pelajaran yang sama.
create or replace function public.check_class_semester_year()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.classes c join public.semesters s on s.academic_year_id = c.academic_year_id
    where c.id = new.class_id and s.id = new.semester_id
  ) then
    raise exception 'Kelas dan semester harus berada pada tahun pelajaran yang sama.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists teaching_assignments_check_year on public.teaching_assignments;
create trigger teaching_assignments_check_year before insert or update of class_id, semester_id on public.teaching_assignments
  for each row execute function public.check_class_semester_year();

drop trigger if exists class_guardians_check_year on public.class_guardians;
create trigger class_guardians_check_year before insert or update of class_id, semester_id on public.class_guardians
  for each row execute function public.check_class_semester_year();

-- Jadwal tidak boleh bentrok: kelas yang sama atau guru yang sama pada jam yang beririsan.
create or replace function public.check_schedule_conflict()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ta public.teaching_assignments;
  v_conflict text;
begin
  select * into v_ta from public.teaching_assignments where id = new.teaching_assignment_id;

  select format('%s (%s) pukul %s–%s', sub.name, c.name, to_char(s.start_time, 'HH24:MI'), to_char(s.end_time, 'HH24:MI'))
    into v_conflict
  from public.schedules s
  join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.classes c on c.id = ta.class_id
  where s.id <> new.id
    and s.day_of_week = new.day_of_week
    and ta.semester_id = v_ta.semester_id
    and ta.class_id = v_ta.class_id
    and s.start_time < new.end_time and new.start_time < s.end_time
  limit 1;
  if v_conflict is not null then
    raise exception 'Jadwal bentrok dengan % di kelas yang sama.', v_conflict using errcode = '23P01';
  end if;

  select format('%s (%s) pukul %s–%s', sub.name, c.name, to_char(s.start_time, 'HH24:MI'), to_char(s.end_time, 'HH24:MI'))
    into v_conflict
  from public.schedules s
  join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.classes c on c.id = ta.class_id
  where s.id <> new.id
    and s.day_of_week = new.day_of_week
    and ta.semester_id = v_ta.semester_id
    and ta.teacher_id = v_ta.teacher_id
    and s.start_time < new.end_time and new.start_time < s.end_time
  limit 1;
  if v_conflict is not null then
    raise exception 'Guru sudah mengajar % pada waktu tersebut.', v_conflict using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists schedules_check_conflict on public.schedules;
create trigger schedules_check_conflict before insert or update on public.schedules
  for each row execute function public.check_schedule_conflict();

-- ---------------------------------------------------------------------
-- Audit (data penting & perubahan penugasan)
-- Penambahan siswa/guru dicatat oleh Edge Function (user.create / bulk).
-- ---------------------------------------------------------------------
drop trigger if exists teaching_assignments_audit on public.teaching_assignments;
create trigger teaching_assignments_audit after insert or update or delete on public.teaching_assignments
  for each row execute function public.audit_row_change();

drop trigger if exists class_guardians_audit on public.class_guardians;
create trigger class_guardians_audit after insert or update or delete on public.class_guardians
  for each row execute function public.audit_row_change();

drop trigger if exists class_enrollments_audit on public.class_enrollments;
create trigger class_enrollments_audit after insert or update or delete on public.class_enrollments
  for each row execute function public.audit_row_change();

drop trigger if exists students_audit on public.students;
create trigger students_audit after update or delete on public.students
  for each row execute function public.audit_row_change();

drop trigger if exists teachers_audit on public.teachers;
create trigger teachers_audit after update or delete on public.teachers
  for each row execute function public.audit_row_change();

drop trigger if exists semesters_audit on public.semesters;
create trigger semesters_audit after update on public.semesters
  for each row execute function public.audit_row_change();

drop trigger if exists classes_audit on public.classes;
create trigger classes_audit after insert or update or delete on public.classes
  for each row execute function public.audit_row_change();

drop trigger if exists subjects_audit on public.subjects;
create trigger subjects_audit after insert or update or delete on public.subjects
  for each row execute function public.audit_row_change();
