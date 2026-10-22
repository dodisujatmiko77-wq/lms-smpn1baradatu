-- =====================================================================
-- 0005 — Ruang kelas digital: bab, pertemuan, materi, progress belajar
-- Tahap 3 (Pembelajaran)
--
-- Semua konten menempel pada teaching_assignments (guru × kelas × mapel × semester).
-- Kolom teaching_assignment_id didenormalisasi ke tiap tabel agar RLS cepat.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lesson_status') then
    create type public.lesson_status as enum ('draft', 'published');
  end if;
  if not exists (select 1 from pg_type where typname = 'material_type') then
    create type public.material_type as enum ('pdf', 'image', 'video', 'link', 'presentation', 'document', 'file');
  end if;
  if not exists (select 1 from pg_type where typname = 'progress_status') then
    create type public.progress_status as enum ('in_progress', 'completed');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------

-- Bab / topik
create table if not exists public.course_sections (
  id                      uuid primary key default gen_random_uuid(),
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  title                   text not null,
  description             text,
  position                integer not null default 0,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint course_sections_title_len check (char_length(title) between 1 and 150)
);
create index if not exists course_sections_ta_idx on public.course_sections (teaching_assignment_id, position);

-- Pertemuan
create table if not exists public.lessons (
  id                      uuid primary key default gen_random_uuid(),
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  section_id              uuid references public.course_sections (id) on delete set null,
  meeting_number          smallint,
  title                   text not null,
  summary                 text,
  content_html            text,
  status                  public.lesson_status not null default 'draft',
  published_at            timestamptz,
  position                integer not null default 0,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint lessons_title_len check (char_length(title) between 1 and 200),
  constraint lessons_meeting check (meeting_number is null or meeting_number between 1 and 200),
  constraint lessons_content_size check (content_html is null or octet_length(content_html) <= 200000)
);
create index if not exists lessons_ta_idx on public.lessons (teaching_assignment_id, status, position);
create index if not exists lessons_section_idx on public.lessons (section_id);

-- Materi dalam pertemuan
create table if not exists public.lesson_materials (
  id                      uuid primary key default gen_random_uuid(),
  lesson_id               uuid not null references public.lessons (id) on delete cascade,
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  type                    public.material_type not null,
  title                   text not null,
  url                     text,                          -- video YouTube / tautan
  storage_path            text,                          -- berkas di bucket "materials"
  file_name               text,
  mime_type               text,
  size_bytes              bigint,
  position                integer not null default 0,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint lesson_materials_title_len check (char_length(title) between 1 and 200),
  constraint lesson_materials_source check (
    (type in ('video', 'link') and url is not null and url ~* '^https?://')
    or (type not in ('video', 'link') and storage_path is not null)
  ),
  constraint lesson_materials_size check (size_bytes is null or size_bytes between 0 and 52428800)
);
create index if not exists lesson_materials_lesson_idx on public.lesson_materials (lesson_id, position);
create index if not exists lesson_materials_ta_idx on public.lesson_materials (teaching_assignment_id);

-- Progress belajar siswa per pertemuan
create table if not exists public.lesson_progress (
  id                      uuid primary key default gen_random_uuid(),
  lesson_id               uuid not null references public.lessons (id) on delete cascade,
  student_id              uuid not null references public.students (id) on delete cascade,
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  status                  public.progress_status not null default 'in_progress',
  first_viewed_at         timestamptz not null default now(),
  last_viewed_at          timestamptz not null default now(),
  completed_at            timestamptz,
  view_count              integer not null default 1,
  constraint lesson_progress_unique unique (lesson_id, student_id)
);
create index if not exists lesson_progress_student_idx on public.lesson_progress (student_id, teaching_assignment_id);
create index if not exists lesson_progress_ta_idx on public.lesson_progress (teaching_assignment_id);

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['course_sections','lessons','lesson_materials']
  loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_set_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end$$;

-- Pertemuan: bab harus milik ruang kelas yang sama; published_at diisi saat dipublikasikan.
create or replace function public.lessons_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.course_sections s
    where s.id = new.section_id and s.teaching_assignment_id = new.teaching_assignment_id
  ) then
    raise exception 'Bab tidak berada di ruang kelas yang sama.' using errcode = '23514';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists lessons_before_write on public.lessons;
create trigger lessons_before_write before insert or update on public.lessons
  for each row execute function public.lessons_before_write();

-- Materi & bab: isi teaching_assignment_id/created_by otomatis dari induknya.
create or replace function public.materials_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select l.teaching_assignment_id into new.teaching_assignment_id from public.lessons l where l.id = new.lesson_id;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists lesson_materials_before_write on public.lesson_materials;
create trigger lesson_materials_before_write before insert or update of lesson_id on public.lesson_materials
  for each row execute function public.materials_before_write();

create or replace function public.sections_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;
drop trigger if exists course_sections_before_insert on public.course_sections;
create trigger course_sections_before_insert before insert on public.course_sections
  for each row execute function public.sections_before_insert();

-- Audit: publikasi & penghapusan pertemuan dicatat (perubahan isi tidak, agar log tidak membengkak).
create or replace function public.audit_lesson_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'lessons.delete', 'lessons', old.id::text,
            jsonb_build_object('title', old.title, 'teaching_assignment_id', old.teaching_assignment_id));
  elsif new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), case when new.status = 'published' then 'lessons.publish' else 'lessons.unpublish' end,
            'lessons', new.id::text, jsonb_build_object('title', new.title, 'teaching_assignment_id', new.teaching_assignment_id));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists lessons_audit on public.lessons;
create trigger lessons_audit after update of status or delete on public.lessons
  for each row execute function public.audit_lesson_change();

-- ---------------------------------------------------------------------
-- Helper hak akses
-- ---------------------------------------------------------------------

-- Boleh mengelola konten ruang kelas: admin atau guru pengampu.
create or replace function public.can_manage_ta(p_ta_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.teaching_assignments ta
    where ta.id = p_ta_id and ta.teacher_id = public.current_teacher_id()
  )
$$;

-- Boleh memantau progress: admin, guru pengampu, wali kelas.
create or replace function public.can_monitor_ta(p_ta_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_manage_ta(p_ta_id) or exists (
    select 1 from public.teaching_assignments ta
    where ta.id = p_ta_id and public.guards_class(ta.class_id)
  )
$$;

create or replace function public.lesson_is_published(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.lessons where id = p_lesson_id and status = 'published') $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.course_sections  enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.lesson_progress  enable row level security;

drop policy if exists course_sections_select on public.course_sections;
create policy course_sections_select on public.course_sections for select to authenticated
  using (public.can_view_ta(teaching_assignment_id));
drop policy if exists course_sections_write on public.course_sections;
create policy course_sections_write on public.course_sections for all to authenticated
  using (public.can_manage_ta(teaching_assignment_id)) with check (public.can_manage_ta(teaching_assignment_id));

-- Siswa & wali kelas hanya melihat pertemuan yang sudah dipublikasikan.
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using (public.can_manage_ta(teaching_assignment_id) or (status = 'published' and public.can_view_ta(teaching_assignment_id)));
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using (public.can_manage_ta(teaching_assignment_id)) with check (public.can_manage_ta(teaching_assignment_id));

drop policy if exists lesson_materials_select on public.lesson_materials;
create policy lesson_materials_select on public.lesson_materials for select to authenticated
  using (public.can_manage_ta(teaching_assignment_id) or (public.lesson_is_published(lesson_id) and public.can_view_ta(teaching_assignment_id)));
drop policy if exists lesson_materials_write on public.lesson_materials;
create policy lesson_materials_write on public.lesson_materials for all to authenticated
  using (public.can_manage_ta(teaching_assignment_id)) with check (public.can_manage_ta(teaching_assignment_id));

-- Progress: siswa membaca miliknya; guru/wali/admin memantau. Penulisan hanya lewat RPC.
drop policy if exists lesson_progress_select on public.lesson_progress;
create policy lesson_progress_select on public.lesson_progress for select to authenticated
  using (student_id = (select public.current_student_id()) or public.can_monitor_ta(teaching_assignment_id));

revoke all on public.course_sections, public.lessons, public.lesson_materials, public.lesson_progress from anon;
grant select, insert, update, delete on public.course_sections, public.lessons, public.lesson_materials to authenticated;
revoke all on public.lesson_progress from authenticated;
grant select on public.lesson_progress to authenticated;

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Siswa membuka / menyelesaikan pertemuan. p_action: 'open' | 'complete' | 'undo'
create or replace function public.mark_lesson_progress(p_lesson_id uuid, p_action text default 'open')
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_lesson public.lessons;
  v_row public.lesson_progress;
begin
  if v_student is null then
    raise exception 'Hanya siswa yang mencatat progress belajar.' using errcode = '42501';
  end if;
  select * into v_lesson from public.lessons where id = p_lesson_id and status = 'published';
  if v_lesson.id is null or not exists (
    select 1 from public.teaching_assignments ta
    where ta.id = v_lesson.teaching_assignment_id and public.student_in_class(ta.class_id)
  ) then
    raise exception 'Pertemuan tidak ditemukan.' using errcode = 'P0002';
  end if;

  insert into public.lesson_progress (lesson_id, student_id, teaching_assignment_id, status, completed_at)
  values (p_lesson_id, v_student, v_lesson.teaching_assignment_id,
          case when p_action = 'complete' then 'completed'::public.progress_status else 'in_progress' end,
          case when p_action = 'complete' then now() end)
  on conflict (lesson_id, student_id) do update set
    last_viewed_at = now(),
    view_count = public.lesson_progress.view_count + case when p_action = 'open' then 1 else 0 end,
    status = case
      when p_action = 'complete' then 'completed'::public.progress_status
      when p_action = 'undo' then 'in_progress'::public.progress_status
      else public.lesson_progress.status end,
    completed_at = case
      when p_action = 'complete' then coalesce(public.lesson_progress.completed_at, now())
      when p_action = 'undo' then null
      else public.lesson_progress.completed_at end
  returning * into v_row;

  return jsonb_build_object('status', v_row.status, 'completed_at', v_row.completed_at);
end;
$$;

-- Informasi ruang kelas (judul, guru, kelas) bagi siapa pun yang boleh melihatnya.
create or replace function public.get_course(p_ta_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', ta.id,
    'class_id', c.id, 'class_name', c.name, 'grade', c.grade,
    'subject_id', sub.id, 'subject_name', sub.name, 'subject_code', sub.code, 'subject_color', sub.color,
    'teacher_name', p.full_name,
    'semester_id', s.id, 'semester_number', s.number, 'semester_active', s.is_active, 'academic_year', y.name,
    'can_manage', public.can_manage_ta(ta.id),
    'student_count', (select count(*) from public.class_enrollments e where e.class_id = c.id)
  )
  from public.teaching_assignments ta
  join public.classes c on c.id = ta.class_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles p on p.id = t.profile_id
  join public.semesters s on s.id = ta.semester_id
  join public.academic_years y on y.id = s.academic_year_id
  where ta.id = p_ta_id and public.can_view_ta(ta.id)
$$;

-- Mata pelajaran siswa (semester aktif) beserta progress-nya.
create or replace function public.get_my_courses()
returns table (
  teaching_assignment_id uuid, subject_name text, subject_code text, subject_color text, teacher_name text,
  lesson_count integer, completed_count integer, in_progress_count integer, last_viewed_at timestamptz,
  latest_lesson_title text, latest_published_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select ta.id, sub.name, sub.code, sub.color, p.full_name,
         (select count(*) from public.lessons l where l.teaching_assignment_id = ta.id and l.status = 'published')::int,
         (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
           where lp.teaching_assignment_id = ta.id and lp.student_id = public.current_student_id()
             and lp.status = 'completed' and l.status = 'published')::int,
         (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
           where lp.teaching_assignment_id = ta.id and lp.student_id = public.current_student_id()
             and lp.status = 'in_progress' and l.status = 'published')::int,
         (select max(lp.last_viewed_at) from public.lesson_progress lp
           where lp.teaching_assignment_id = ta.id and lp.student_id = public.current_student_id()),
         (select l.title from public.lessons l where l.teaching_assignment_id = ta.id and l.status = 'published'
           order by l.published_at desc limit 1),
         (select max(l.published_at) from public.lessons l where l.teaching_assignment_id = ta.id and l.status = 'published')
  from public.teaching_assignments ta
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles p on p.id = t.profile_id
  where ta.semester_id = public.active_semester_id()
    and ta.class_id in (select e.class_id from public.class_enrollments e where e.student_id = public.current_student_id())
  order by sub.sort_order, sub.name;
$$;

-- Progress per siswa dalam satu ruang kelas (guru pengampu, wali kelas, admin).
create or replace function public.get_course_progress(p_ta_id uuid)
returns table (
  student_id uuid, full_name text, nisn text, gender char(1),
  completed integer, in_progress integer, total integer, last_viewed_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_monitor_ta(p_ta_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select s.id, p.full_name, s.nisn, s.gender,
         count(lp.*) filter (where lp.status = 'completed')::int,
         count(lp.*) filter (where lp.status = 'in_progress')::int,
         (select count(*) from public.lessons l where l.teaching_assignment_id = p_ta_id and l.status = 'published')::int,
         max(lp.last_viewed_at)
  from public.teaching_assignments ta
  join public.class_enrollments e on e.class_id = ta.class_id
  join public.students s on s.id = e.student_id
  join public.profiles p on p.id = s.profile_id
  left join public.lesson_progress lp
    on lp.student_id = s.id and lp.teaching_assignment_id = ta.id
   and exists (select 1 from public.lessons l where l.id = lp.lesson_id and l.status = 'published')
  where ta.id = p_ta_id
  group by s.id, p.full_name, s.nisn, s.gender
  order by p.full_name;
end;
$$;

-- Ringkasan per pertemuan (berapa siswa selesai) untuk guru.
create or replace function public.get_lesson_stats(p_ta_id uuid)
returns table (lesson_id uuid, completed integer, in_progress integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_monitor_ta(p_ta_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select lp.lesson_id,
         count(*) filter (where lp.status = 'completed')::int,
         count(*) filter (where lp.status = 'in_progress')::int
  from public.lesson_progress lp
  where lp.teaching_assignment_id = p_ta_id
  group by lp.lesson_id;
end;
$$;

-- Penggunaan penyimpanan materi (admin) — untuk memantau kuota Supabase.
create or replace function public.admin_storage_usage()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_bytes', (select coalesce(sum(size_bytes), 0) from public.lesson_materials where storage_path is not null),
    'file_count', (select count(*) from public.lesson_materials where storage_path is not null),
    'link_count', (select count(*) from public.lesson_materials where storage_path is null),
    'by_type', (
      select coalesce(jsonb_agg(jsonb_build_object('type', type, 'count', n, 'bytes', b) order by b desc), '[]'::jsonb)
      from (select type, count(*) n, coalesce(sum(size_bytes), 0) b from public.lesson_materials group by type) t
    ),
    'by_subject', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', name, 'color', color, 'count', n, 'bytes', b) order by b desc), '[]'::jsonb)
      from (
        select sub.name, sub.color, count(m.*) n, coalesce(sum(m.size_bytes), 0) b
        from public.lesson_materials m
        join public.teaching_assignments ta on ta.id = m.teaching_assignment_id
        join public.subjects sub on sub.id = ta.subject_id
        where m.storage_path is not null
        group by sub.name, sub.color
      ) t
    )
  );
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'can_manage_ta(uuid)', 'can_monitor_ta(uuid)', 'lesson_is_published(uuid)',
    'mark_lesson_progress(uuid, text)', 'get_course(uuid)', 'get_my_courses()',
    'get_course_progress(uuid)', 'get_lesson_stats(uuid)', 'admin_storage_usage()'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end$$;

revoke execute on function public.lessons_before_write() from public, anon, authenticated;
revoke execute on function public.materials_before_write() from public, anon, authenticated;
revoke execute on function public.sections_before_insert() from public, anon, authenticated;
revoke execute on function public.audit_lesson_change() from public, anon, authenticated;
