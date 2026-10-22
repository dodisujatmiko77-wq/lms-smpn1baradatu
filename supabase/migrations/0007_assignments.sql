-- =====================================================================
-- 0007 — Tugas online: tugas, pengumpulan, nilai & umpan balik
-- Tahap 4 (Tugas)
--
-- Berkas disimpan di bucket privat "assignment-files":
--   {teaching_assignment_id}/{assignment_id}/lampiran/{berkas}           ← lampiran guru
--   {teaching_assignment_id}/{assignment_id}/siswa/{student_id}/{berkas} ← jawaban siswa
-- Siswa menulis pengumpulan HANYA lewat RPC save_submission (validasi tenggat di server).
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('draft', 'submitted');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id                      uuid primary key default gen_random_uuid(),
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  title                   text not null,
  description             text,
  instructions_html       text,
  attachments             jsonb not null default '[]'::jsonb,   -- [{id,type,title,url,storage_path,file_name,mime_type,size_bytes}]
  submission_types        text[] not null default array['text'],
  start_at                timestamptz not null default now(),
  due_at                  timestamptz not null,
  max_score               numeric(6,2) not null default 100,
  allow_late              boolean not null default true,
  status                  public.lesson_status not null default 'draft',
  published_at            timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint assignments_title_len check (char_length(title) between 1 and 200),
  constraint assignments_dates check (due_at > start_at),
  constraint assignments_max_score check (max_score between 1 and 1000),
  constraint assignments_types check (
    cardinality(submission_types) between 1 and 4
    and submission_types <@ array['text', 'file', 'image', 'link']
  ),
  constraint assignments_attachments_array check (jsonb_typeof(attachments) = 'array'),
  constraint assignments_instructions_size check (instructions_html is null or octet_length(instructions_html) <= 200000)
);
create index if not exists assignments_ta_idx on public.assignments (teaching_assignment_id, status, due_at);

create table if not exists public.assignment_submissions (
  id                      uuid primary key default gen_random_uuid(),
  assignment_id           uuid not null references public.assignments (id) on delete cascade,
  student_id              uuid not null references public.students (id) on delete cascade,
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  status                  public.submission_status not null default 'draft',
  text_answer             text,
  link_url                text,
  files                   jsonb not null default '[]'::jsonb,   -- [{storage_path,file_name,mime_type,size_bytes}]
  submitted_at            timestamptz,
  is_late                 boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint assignment_submissions_unique unique (assignment_id, student_id),
  constraint assignment_submissions_text_len check (text_answer is null or char_length(text_answer) <= 20000),
  constraint assignment_submissions_link check (link_url is null or link_url ~* '^https?://'),
  constraint assignment_submissions_files check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10)
);
create index if not exists assignment_submissions_ta_idx on public.assignment_submissions (teaching_assignment_id, status);
create index if not exists assignment_submissions_student_idx on public.assignment_submissions (student_id);

-- Nilai per (tugas, siswa); boleh tanpa pengumpulan (mis. tidak mengumpulkan → 0).
create table if not exists public.assignment_grades (
  id                      uuid primary key default gen_random_uuid(),
  assignment_id           uuid not null references public.assignments (id) on delete cascade,
  student_id              uuid not null references public.students (id) on delete cascade,
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  submission_id           uuid references public.assignment_submissions (id) on delete set null,
  score                   numeric(6,2) not null,
  feedback                text,
  graded_by               uuid references public.profiles (id) on delete set null,
  graded_at               timestamptz not null default now(),
  published_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint assignment_grades_unique unique (assignment_id, student_id),
  constraint assignment_grades_score check (score >= 0),
  constraint assignment_grades_feedback_len check (feedback is null or char_length(feedback) <= 5000)
);
create index if not exists assignment_grades_ta_idx on public.assignment_grades (teaching_assignment_id);
create index if not exists assignment_grades_student_idx on public.assignment_grades (student_id);

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['assignments','assignment_submissions','assignment_grades']
  loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_set_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end$$;

create or replace function public.assignments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  elsif new.teaching_assignment_id <> old.teaching_assignment_id then
    raise exception 'Tugas tidak dapat dipindah ke ruang kelas lain.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists assignments_before_write on public.assignments;
create trigger assignments_before_write before insert or update on public.assignments
  for each row execute function public.assignments_before_write();

-- Nilai: isi data turunan, pastikan siswa anggota kelas & skor ≤ nilai maksimum.
create or replace function public.grades_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a public.assignments;
begin
  select * into v_a from public.assignments where id = new.assignment_id;
  new.teaching_assignment_id := v_a.teaching_assignment_id;
  if new.score > v_a.max_score then
    raise exception 'Nilai melebihi nilai maksimum (%).', v_a.max_score using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.class_enrollments e
    join public.teaching_assignments ta on ta.class_id = e.class_id
    where ta.id = v_a.teaching_assignment_id and e.student_id = new.student_id
  ) then
    raise exception 'Siswa bukan anggota kelas ini.' using errcode = '23514';
  end if;
  select s.id into new.submission_id from public.assignment_submissions s
  where s.assignment_id = new.assignment_id and s.student_id = new.student_id;
  new.graded_by := auth.uid();
  if tg_op = 'INSERT' or new.score is distinct from old.score or new.feedback is distinct from old.feedback then
    new.graded_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists assignment_grades_before_write on public.assignment_grades;
create trigger assignment_grades_before_write before insert or update on public.assignment_grades
  for each row execute function public.grades_before_write();

-- Audit: perubahan nilai selalu tercatat; tugas dicatat saat terbit/ditarik/dihapus.
drop trigger if exists assignment_grades_audit on public.assignment_grades;
create trigger assignment_grades_audit after insert or update of score or delete on public.assignment_grades
  for each row execute function public.audit_row_change();

create or replace function public.audit_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'assignments.delete', 'assignments', old.id::text,
            jsonb_build_object('title', old.title, 'teaching_assignment_id', old.teaching_assignment_id));
  elsif new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), case when new.status = 'published' then 'assignments.publish' else 'assignments.unpublish' end,
            'assignments', new.id::text, jsonb_build_object('title', new.title, 'due_at', new.due_at));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists assignments_audit on public.assignments;
create trigger assignments_audit after update of status or delete on public.assignments
  for each row execute function public.audit_assignment_change();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.assignments            enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_grades      enable row level security;

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
  using (public.can_manage_ta(teaching_assignment_id) or (status = 'published' and public.can_view_ta(teaching_assignment_id)));
drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments for all to authenticated
  using (public.can_manage_ta(teaching_assignment_id)) with check (public.can_manage_ta(teaching_assignment_id));

-- Pengumpulan: siswa membaca miliknya; guru/wali/admin memantau. Tulis hanya via RPC.
drop policy if exists assignment_submissions_select on public.assignment_submissions;
create policy assignment_submissions_select on public.assignment_submissions for select to authenticated
  using (student_id = (select public.current_student_id()) or public.can_monitor_ta(teaching_assignment_id));

-- Nilai: guru pengampu/admin mengelola; wali kelas membaca; siswa membaca miliknya yang sudah terbit.
drop policy if exists assignment_grades_select on public.assignment_grades;
create policy assignment_grades_select on public.assignment_grades for select to authenticated
  using (
    public.can_monitor_ta(teaching_assignment_id)
    or (student_id = (select public.current_student_id()) and published_at is not null)
  );
drop policy if exists assignment_grades_write on public.assignment_grades;
create policy assignment_grades_write on public.assignment_grades for all to authenticated
  using (public.can_manage_ta(teaching_assignment_id))
  with check (public.can_manage_ta((select a.teaching_assignment_id from public.assignments a where a.id = assignment_id)));

revoke all on public.assignments, public.assignment_submissions, public.assignment_grades from anon;
grant select, insert, update, delete on public.assignments, public.assignment_grades to authenticated;
revoke all on public.assignment_submissions from authenticated;
grant select on public.assignment_submissions to authenticated;

-- ---------------------------------------------------------------------
-- Storage: bucket berkas tugas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-files', 'assignment-files', false, 52428800, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet'
])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Siswa boleh mengubah pengumpulannya? (terbit, sudah dibuka, belum lewat tenggat bila tidak boleh terlambat,
-- belum dikumpulkan / masih draf, dan belum ada nilai yang terbit)
create or replace function public.submission_editable(p_assignment_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    join public.class_enrollments e on e.class_id = ta.class_id and e.student_id = p_student_id
    where a.id = p_assignment_id
      and a.status = 'published'
      and a.start_at <= now()
      and (a.allow_late or now() <= a.due_at)
  )
  and not exists (
    select 1 from public.assignment_submissions s
    where s.assignment_id = p_assignment_id and s.student_id = p_student_id and s.status = 'submitted'
  )
  and not exists (
    select 1 from public.assignment_grades g
    where g.assignment_id = p_assignment_id and g.student_id = p_student_id and g.published_at is not null
  )
$$;

create or replace function public.can_read_assignment_object(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case split_part(p_name, '/', 3)
    when 'lampiran' then
      public.can_manage_ta(public.try_uuid(split_part(p_name, '/', 1)))
      or (public.can_view_ta(public.try_uuid(split_part(p_name, '/', 1))) and exists (
        select 1 from public.assignments a
        where a.id = public.try_uuid(split_part(p_name, '/', 2))
          and a.teaching_assignment_id = public.try_uuid(split_part(p_name, '/', 1))
          and a.status = 'published'))
    when 'siswa' then
      public.can_monitor_ta(public.try_uuid(split_part(p_name, '/', 1)))
      or public.try_uuid(split_part(p_name, '/', 4)) = public.current_student_id()
    else false
  end
$$;

create or replace function public.can_write_assignment_object(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    where a.id = public.try_uuid(split_part(p_name, '/', 2))
      and a.teaching_assignment_id = public.try_uuid(split_part(p_name, '/', 1))
  )
  and case split_part(p_name, '/', 3)
    when 'lampiran' then public.can_manage_ta(public.try_uuid(split_part(p_name, '/', 1)))
    when 'siswa' then
      public.try_uuid(split_part(p_name, '/', 4)) = public.current_student_id()
      and public.submission_editable(public.try_uuid(split_part(p_name, '/', 2)), public.current_student_id())
    else false
  end
$$;

-- Hapus: penulis yang sah, ATAU guru pengampu (membersihkan berkas siswa saat tugas dihapus).
create or replace function public.can_delete_assignment_object(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_write_assignment_object(p_name)
      or public.can_manage_ta(public.try_uuid(split_part(p_name, '/', 1)))
$$;

drop policy if exists "assignment_files_select" on storage.objects;
create policy "assignment_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'assignment-files' and public.can_read_assignment_object(name));
drop policy if exists "assignment_files_insert" on storage.objects;
create policy "assignment_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-files' and public.can_write_assignment_object(name));
drop policy if exists "assignment_files_update" on storage.objects;
create policy "assignment_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'assignment-files' and public.can_write_assignment_object(name))
  with check (bucket_id = 'assignment-files' and public.can_write_assignment_object(name));
drop policy if exists "assignment_files_delete" on storage.objects;
create policy "assignment_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'assignment-files' and public.can_delete_assignment_object(name));

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Siswa menyimpan / mengumpulkan / membatalkan pengumpulan. p_action: 'save' | 'submit' | 'unsubmit'
create or replace function public.save_submission(
  p_assignment_id uuid,
  p_action text,
  p_text text default null,
  p_link text default null,
  p_files jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_a public.assignments;
  v_sub public.assignment_submissions;
  v_prefix text;
  v_f jsonb;
begin
  if v_student is null then
    raise exception 'Hanya siswa yang dapat mengumpulkan tugas.' using errcode = '42501';
  end if;
  select a.* into v_a from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  join public.class_enrollments e on e.class_id = ta.class_id and e.student_id = v_student
  where a.id = p_assignment_id and a.status = 'published';
  if v_a.id is null then
    raise exception 'Tugas tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_a.start_at > now() then
    raise exception 'Tugas belum dibuka.' using errcode = '22023';
  end if;
  if exists (select 1 from public.assignment_grades g where g.assignment_id = p_assignment_id and g.student_id = v_student and g.published_at is not null) then
    raise exception 'Tugas sudah dinilai dan tidak dapat diubah lagi.' using errcode = '22023';
  end if;
  select * into v_sub from public.assignment_submissions where assignment_id = p_assignment_id and student_id = v_student;

  if p_action = 'unsubmit' then
    if v_sub.id is null or v_sub.status <> 'submitted' then
      raise exception 'Tugas belum dikumpulkan.' using errcode = '22023';
    end if;
    if not v_a.allow_late and now() > v_a.due_at then
      raise exception 'Tenggat sudah lewat; pengumpulan tidak dapat dibatalkan.' using errcode = '22023';
    end if;
    if exists (select 1 from public.assignment_grades g where g.assignment_id = p_assignment_id and g.student_id = v_student) then
      raise exception 'Guru sudah mulai menilai; pengumpulan tidak dapat dibatalkan.' using errcode = '22023';
    end if;
    update public.assignment_submissions set status = 'draft', submitted_at = null, is_late = false where id = v_sub.id;
    return jsonb_build_object('status', 'draft');
  end if;

  if p_action not in ('save', 'submit') then
    raise exception 'Aksi tidak dikenal.' using errcode = '22023';
  end if;
  if v_sub.status = 'submitted' then
    raise exception 'Tugas sudah dikumpulkan. Batalkan pengumpulan terlebih dahulu untuk mengubah jawaban.' using errcode = '22023';
  end if;
  if not v_a.allow_late and now() > v_a.due_at then
    raise exception 'Tenggat sudah lewat dan tugas ini tidak menerima pengumpulan terlambat.' using errcode = '22023';
  end if;

  -- Validasi jawaban sesuai jenis pengumpulan yang diizinkan.
  p_text := nullif(trim(p_text), '');
  p_link := nullif(trim(p_link), '');
  if p_text is not null and not ('text' = any (v_a.submission_types)) then p_text := null; end if;
  if p_link is not null and not ('link' = any (v_a.submission_types)) then p_link := null; end if;
  if p_link is not null and p_link !~* '^https?://' then
    raise exception 'Tautan harus diawali https:// atau http://' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' then
    raise exception 'Format berkas tidak valid.' using errcode = '22023';
  end if;
  v_prefix := v_a.teaching_assignment_id || '/' || p_assignment_id || '/siswa/' || v_student || '/';
  for v_f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if position(v_prefix in coalesce(v_f ->> 'storage_path', '')) <> 1 then
      raise exception 'Berkas tidak valid.' using errcode = '22023';
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 0 and not (v_a.submission_types && array['file', 'image']) then
    raise exception 'Tugas ini tidak menerima unggahan berkas.' using errcode = '22023';
  end if;
  if p_action = 'submit' and p_text is null and p_link is null and jsonb_array_length(coalesce(p_files, '[]'::jsonb)) = 0 then
    raise exception 'Jawaban masih kosong.' using errcode = '22023';
  end if;

  insert into public.assignment_submissions as s (assignment_id, student_id, teaching_assignment_id, status, text_answer, link_url, files, submitted_at, is_late)
  values (p_assignment_id, v_student, v_a.teaching_assignment_id,
          case when p_action = 'submit' then 'submitted'::public.submission_status else 'draft' end,
          p_text, p_link, coalesce(p_files, '[]'::jsonb),
          case when p_action = 'submit' then now() end,
          p_action = 'submit' and now() > v_a.due_at)
  on conflict (assignment_id, student_id) do update set
    status = excluded.status, text_answer = excluded.text_answer, link_url = excluded.link_url,
    files = excluded.files, submitted_at = excluded.submitted_at, is_late = excluded.is_late
  returning * into v_sub;

  return jsonb_build_object('status', v_sub.status, 'submitted_at', v_sub.submitted_at, 'is_late', v_sub.is_late);
end;
$$;

-- Daftar tugas siswa (semester aktif) + status pengumpulan + nilai yang sudah terbit.
create or replace function public.get_my_assignments()
returns table (
  id uuid, teaching_assignment_id uuid, title text, description text, start_at timestamptz, due_at timestamptz,
  max_score numeric, allow_late boolean, submission_types text[],
  subject_name text, subject_code text, subject_color text, teacher_name text,
  submission_status text, submitted_at timestamptz, is_late boolean,
  score numeric, feedback text, graded_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.teaching_assignment_id, a.title, a.description, a.start_at, a.due_at, a.max_score, a.allow_late, a.submission_types,
         sub.name, sub.code, sub.color, p.full_name,
         s.status::text, s.submitted_at, coalesce(s.is_late, false),
         g.score, g.feedback, g.published_at
  from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles p on p.id = t.profile_id
  left join public.assignment_submissions s on s.assignment_id = a.id and s.student_id = public.current_student_id()
  left join public.assignment_grades g on g.assignment_id = a.id and g.student_id = public.current_student_id() and g.published_at is not null
  where a.status = 'published'
    and ta.semester_id = public.active_semester_id()
    and ta.class_id in (select e.class_id from public.class_enrollments e where e.student_id = public.current_student_id())
  order by a.due_at;
$$;

-- Ringkasan tugas per ruang kelas (guru/wali/admin).
create or replace function public.get_course_assignments(p_ta_id uuid)
returns table (
  id uuid, title text, status text, start_at timestamptz, due_at timestamptz, max_score numeric, published_at timestamptz,
  student_count integer, submitted integer, late integer, graded integer, grades_published integer, updated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_monitor_ta(p_ta_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select a.id, a.title, a.status::text, a.start_at, a.due_at, a.max_score, a.published_at,
         (select count(*) from public.class_enrollments e join public.teaching_assignments ta on ta.class_id = e.class_id where ta.id = p_ta_id)::int,
         (select count(*) from public.assignment_submissions s where s.assignment_id = a.id and s.status = 'submitted')::int,
         (select count(*) from public.assignment_submissions s where s.assignment_id = a.id and s.status = 'submitted' and s.is_late)::int,
         (select count(*) from public.assignment_grades g where g.assignment_id = a.id)::int,
         (select count(*) from public.assignment_grades g where g.assignment_id = a.id and g.published_at is not null)::int,
         a.updated_at
  from public.assignments a
  where a.teaching_assignment_id = p_ta_id
    and (a.status = 'published' or public.can_manage_ta(p_ta_id))
  order by a.due_at desc;
end;
$$;

-- Papan pemeriksaan: semua siswa kelas + pengumpulan + nilai untuk satu tugas.
create or replace function public.get_assignment_board(p_assignment_id uuid)
returns table (
  student_id uuid, full_name text, nisn text, submission_id uuid, submission_status text, submitted_at timestamptz,
  is_late boolean, text_answer text, link_url text, files jsonb, grade_id uuid, score numeric, feedback text,
  graded_at timestamptz, published_at timestamptz
)
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
  select st.id, p.full_name, st.nisn, s.id, s.status::text, s.submitted_at, coalesce(s.is_late, false),
         s.text_answer, s.link_url, coalesce(s.files, '[]'::jsonb), g.id, g.score, g.feedback, g.graded_at, g.published_at
  from public.teaching_assignments ta
  join public.class_enrollments e on e.class_id = ta.class_id
  join public.students st on st.id = e.student_id
  join public.profiles p on p.id = st.profile_id
  left join public.assignment_submissions s on s.assignment_id = p_assignment_id and s.student_id = st.id
  left join public.assignment_grades g on g.assignment_id = p_assignment_id and g.student_id = st.id
  where ta.id = v_ta
  order by p.full_name;
end;
$$;

-- Antrean pemeriksaan guru: pengumpulan yang belum dinilai di semua ruang kelasnya.
create or replace function public.get_grading_queue()
returns table (
  assignment_id uuid, assignment_title text, teaching_assignment_id uuid, class_name text, subject_name text,
  subject_color text, due_at timestamptz, waiting integer, oldest_submitted_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, ta.id, c.name, sub.name, sub.color, a.due_at,
         count(s.*)::int, min(s.submitted_at)
  from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  join public.classes c on c.id = ta.class_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.assignment_submissions s on s.assignment_id = a.id and s.status = 'submitted'
  where ta.teacher_id = public.current_teacher_id()
    and ta.semester_id = public.active_semester_id()
    and not exists (select 1 from public.assignment_grades g where g.assignment_id = a.id and g.student_id = s.student_id)
  group by a.id, a.title, ta.id, c.name, sub.name, sub.color, a.due_at
  order by min(s.submitted_at);
$$;

-- Terbitkan nilai yang sudah diisi (semua siswa atau sebagian).
create or replace function public.publish_grades(p_assignment_id uuid, p_student_ids uuid[] default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ta uuid;
  v_count integer;
begin
  select teaching_assignment_id into v_ta from public.assignments where id = p_assignment_id;
  if v_ta is null or not public.can_manage_ta(v_ta) then
    raise exception 'Hanya guru pengampu yang dapat menerbitkan nilai.' using errcode = '42501';
  end if;
  update public.assignment_grades set published_at = now()
  where assignment_id = p_assignment_id and published_at is null
    and (p_student_ids is null or student_id = any (p_student_ids));
  get diagnostics v_count = row_count;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'assignment_grades.publish', 'assignments', p_assignment_id::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

-- Penggunaan penyimpanan (admin) — kini termasuk berkas tugas.
create or replace function public.admin_storage_usage()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_assign_bytes bigint;
  v_assign_count bigint;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  select coalesce(sum((f ->> 'size_bytes')::bigint), 0), count(*) into v_assign_bytes, v_assign_count
  from (
    select jsonb_array_elements(attachments) f from public.assignments
    union all
    select jsonb_array_elements(files) from public.assignment_submissions
  ) x
  where f ->> 'storage_path' is not null;

  return jsonb_build_object(
    'total_bytes', (select coalesce(sum(size_bytes), 0) from public.lesson_materials where storage_path is not null) + v_assign_bytes,
    'file_count', (select count(*) from public.lesson_materials where storage_path is not null) + v_assign_count,
    'assignment_bytes', v_assign_bytes,
    'assignment_file_count', v_assign_count,
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
    'submission_editable(uuid, uuid)', 'can_read_assignment_object(text)', 'can_write_assignment_object(text)',
    'can_delete_assignment_object(text)',
    'save_submission(uuid, text, text, text, jsonb)', 'get_my_assignments()', 'get_course_assignments(uuid)',
    'get_assignment_board(uuid)', 'get_grading_queue()', 'publish_grades(uuid, uuid[])', 'admin_storage_usage()'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end$$;

revoke execute on function public.assignments_before_write() from public, anon, authenticated;
revoke execute on function public.grades_before_write() from public, anon, authenticated;
revoke execute on function public.audit_assignment_change() from public, anon, authenticated;
