-- =====================================================================
-- 0008 — Kuis & ujian online (CBT)
-- Tahap 5 (Kuis & CBT)
--
-- Prinsip keamanan:
--  * Siswa TIDAK punya akses SELECT ke soal, opsi, kunci, maupun jawaban.
--    Soal dikirim lewat get_attempt() yang menyaring kunci jawaban.
--  * Waktu mengikuti server: deadline_at dihitung saat mulai; jawaban ditolak setelahnya.
--  * Penilaian otomatis (PG, benar/salah, isian) dilakukan di server; esai dinilai guru.
--  * Pembahasan & kunci hanya dikirim bila review_mode mengizinkan.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum ('mcq', 'true_false', 'short', 'essay');
  end if;
  if not exists (select 1 from pg_type where typname = 'quiz_review_mode') then
    create type public.quiz_review_mode as enum ('never', 'after_submit', 'after_close');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_status') then
    create type public.attempt_status as enum ('in_progress', 'submitted');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Bank soal
-- ---------------------------------------------------------------------
create table if not exists public.question_banks (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers (id) on delete cascade,
  subject_id   uuid not null references public.subjects (id) on delete restrict,
  grade        smallint,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint question_banks_name_len check (char_length(name) between 1 and 150),
  constraint question_banks_grade check (grade is null or grade between 7 and 9)
);
create index if not exists question_banks_teacher_idx on public.question_banks (teacher_id);

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  bank_id       uuid not null references public.question_banks (id) on delete cascade,
  type          public.question_type not null,
  body          text not null,
  answer_key    text,          -- benar/salah: 'true'/'false'; isian: jawaban diterima (satu per baris); esai: pedoman
  explanation   text,
  points        numeric(6,2) not null default 1,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint quiz_questions_body_len check (char_length(body) between 1 and 10000),
  constraint quiz_questions_points check (points > 0 and points <= 100),
  constraint quiz_questions_tf_key check (type <> 'true_false' or answer_key in ('true', 'false')),
  constraint quiz_questions_short_key check (type <> 'short' or coalesce(trim(answer_key), '') <> '')
);
create index if not exists quiz_questions_bank_idx on public.quiz_questions (bank_id, position);

create table if not exists public.quiz_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions (id) on delete cascade,
  body         text not null,
  is_correct   boolean not null default false,
  position     integer not null default 0,
  constraint quiz_options_body_len check (char_length(body) between 1 and 2000)
);
create index if not exists quiz_options_question_idx on public.quiz_options (question_id, position);

-- ---------------------------------------------------------------------
-- Kuis / ujian
-- ---------------------------------------------------------------------
create table if not exists public.quizzes (
  id                      uuid primary key default gen_random_uuid(),
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  kind                    text not null default 'quiz',      -- quiz | exam
  title                   text not null,
  description             text,
  open_at                 timestamptz not null,
  close_at                timestamptz not null,
  duration_minutes        integer not null default 30,
  max_attempts            integer not null default 1,
  shuffle_questions       boolean not null default true,
  shuffle_options         boolean not null default true,
  review_mode             public.quiz_review_mode not null default 'after_close',
  show_score              boolean not null default true,
  status                  public.lesson_status not null default 'draft',
  published_at            timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint quizzes_kind check (kind in ('quiz', 'exam')),
  constraint quizzes_title_len check (char_length(title) between 1 and 200),
  constraint quizzes_window check (close_at > open_at),
  constraint quizzes_duration check (duration_minutes between 1 and 300),
  constraint quizzes_attempts check (max_attempts between 1 and 10)
);
create index if not exists quizzes_ta_idx on public.quizzes (teaching_assignment_id, status, open_at);

create table if not exists public.quiz_question_items (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes (id) on delete cascade,
  question_id     uuid not null references public.quiz_questions (id) on delete restrict,
  position        integer not null default 0,
  points_override numeric(6,2),
  constraint quiz_question_items_unique unique (quiz_id, question_id),
  constraint quiz_question_items_points check (points_override is null or (points_override > 0 and points_override <= 100))
);
create index if not exists quiz_question_items_quiz_idx on public.quiz_question_items (quiz_id, position);

create table if not exists public.quiz_attempts (
  id                      uuid primary key default gen_random_uuid(),
  quiz_id                 uuid not null references public.quizzes (id) on delete cascade,
  student_id              uuid not null references public.students (id) on delete cascade,
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  attempt_no              integer not null,
  status                  public.attempt_status not null default 'in_progress',
  started_at              timestamptz not null default now(),
  deadline_at             timestamptz not null,
  submitted_at            timestamptz,
  question_order          jsonb not null,   -- [{question_id, option_ids:[...]}]
  score_auto              numeric(8,2),
  score_manual            numeric(8,2),
  score_total             numeric(8,2),
  max_score               numeric(8,2),
  needs_manual            boolean not null default false,
  focus_lost_count        integer not null default 0,
  auto_submitted          boolean not null default false,
  constraint quiz_attempts_unique unique (quiz_id, student_id, attempt_no)
);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, student_id);
create index if not exists quiz_attempts_open_idx on public.quiz_attempts (status, deadline_at) where status = 'in_progress';

create table if not exists public.quiz_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id         uuid not null references public.quiz_questions (id) on delete cascade,
  selected_option_id  uuid references public.quiz_options (id) on delete set null,
  text_answer         text,
  is_correct          boolean,
  score               numeric(6,2),
  graded_by           uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now(),
  constraint quiz_answers_unique unique (attempt_id, question_id),
  constraint quiz_answers_text_len check (text_answer is null or char_length(text_answer) <= 10000)
);
create index if not exists quiz_answers_attempt_idx on public.quiz_answers (attempt_id);

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['question_banks','quiz_questions','quizzes']
  loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_set_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end$$;

create or replace function public.quizzes_before_write()
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
  if new.status = 'published' and (tg_op = 'INSERT' or not exists (
       select 1 from public.quiz_question_items it where it.quiz_id = new.id)) then
    raise exception 'Tambahkan minimal satu soal sebelum kuis diterbitkan.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  elsif new.teaching_assignment_id <> old.teaching_assignment_id then
    raise exception 'Kuis tidak dapat dipindah ke ruang kelas lain.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists quizzes_before_write on public.quizzes;
create trigger quizzes_before_write before insert or update on public.quizzes
  for each row execute function public.quizzes_before_write();

-- Soal kuis hanya boleh diambil dari bank soal milik guru pengampu kuis tersebut.
create or replace function public.quiz_items_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.quizzes q
    join public.teaching_assignments ta on ta.id = q.teaching_assignment_id
    join public.quiz_questions qq on qq.id = new.question_id
    join public.question_banks b on b.id = qq.bank_id
    where q.id = new.quiz_id and b.teacher_id = ta.teacher_id
  ) then
    raise exception 'Soal harus berasal dari bank soal milik guru pengampu.' using errcode = '23514';
  end if;
  if exists (select 1 from public.quiz_attempts a where a.quiz_id = new.quiz_id) then
    raise exception 'Soal tidak dapat diubah karena sudah ada siswa yang mengerjakan.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists quiz_question_items_check on public.quiz_question_items;
create trigger quiz_question_items_check before insert or update on public.quiz_question_items
  for each row execute function public.quiz_items_check();

create or replace function public.quiz_items_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.quiz_attempts a where a.quiz_id = old.quiz_id)
     and exists (select 1 from public.quizzes q where q.id = old.quiz_id) then
    raise exception 'Soal tidak dapat dihapus dari kuis yang sudah dikerjakan siswa.' using errcode = '23514';
  end if;
  return old;
end;
$$;
drop trigger if exists quiz_question_items_before_delete on public.quiz_question_items;
create trigger quiz_question_items_before_delete before delete on public.quiz_question_items
  for each row execute function public.quiz_items_before_delete();

-- Kunci jawaban/skor soal yang sudah dipakai di kuis yang dikerjakan siswa tidak boleh diubah
-- (agar nilai yang sudah keluar tetap konsisten). Perbaikan teks soal tetap boleh.
create or replace function public.question_in_attempted_quiz(p_question_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.quiz_question_items it
    join public.quiz_attempts a on a.quiz_id = it.quiz_id
    where it.question_id = p_question_id
  )
$$;

create or replace function public.quiz_question_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_qid uuid;
begin
  if tg_table_name = 'quiz_questions' then
    if new.type is distinct from old.type or new.answer_key is distinct from old.answer_key
       or new.points is distinct from old.points then
      v_qid := old.id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_correct is distinct from old.is_correct or new.question_id is distinct from old.question_id then
      v_qid := old.question_id;
    end if;
  else
    v_qid := coalesce(new.question_id, old.question_id);
  end if;
  if v_qid is not null and public.question_in_attempted_quiz(v_qid)
     and exists (select 1 from public.quiz_questions where id = v_qid) then
    raise exception 'Kunci jawaban, opsi, dan skor soal ini terkunci karena sudah dikerjakan siswa. Buat salinan soal untuk perubahan.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists quiz_questions_lock on public.quiz_questions;
create trigger quiz_questions_lock before update on public.quiz_questions
  for each row execute function public.quiz_question_lock();
drop trigger if exists quiz_options_lock on public.quiz_options;
create trigger quiz_options_lock before insert or update or delete on public.quiz_options
  for each row execute function public.quiz_question_lock();

-- Audit
create or replace function public.audit_quiz_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'quizzes.delete', 'quizzes', old.id::text, jsonb_build_object('title', old.title));
  elsif new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), case when new.status = 'published' then 'quizzes.publish' else 'quizzes.unpublish' end,
            'quizzes', new.id::text, jsonb_build_object('title', new.title, 'open_at', new.open_at, 'close_at', new.close_at));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists quizzes_audit on public.quizzes;
create trigger quizzes_audit after update of status or delete on public.quizzes
  for each row execute function public.audit_quiz_change();

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------
create or replace function public.owns_bank(p_bank_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.question_banks b where b.id = p_bank_id and b.teacher_id = public.current_teacher_id()
  )
$$;

create or replace function public.owns_question(p_question_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.owns_bank((select bank_id from public.quiz_questions where id = p_question_id))
$$;

-- Normalisasi jawaban isian: huruf kecil, spasi dirapikan.
create or replace function public.normalize_answer(p text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g')) $$;

-- Menilai & menutup satu percobaan (dipanggil saat submit / waktu habis).
create or replace function public.finalize_attempt(p_attempt_id uuid, p_auto boolean default false)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id for update;
  if v_att.id is null or v_att.status = 'submitted' then
    return;
  end if;

  -- Nilai otomatis untuk soal objektif.
  update public.quiz_answers ans set
    is_correct = r.correct,
    score = case when r.correct then r.pts else 0 end
  from (
    select a.id,
           coalesce(it.points_override, q.points) as pts,
           coalesce(case q.type
             when 'mcq' then (select o.is_correct from public.quiz_options o where o.id = a.selected_option_id)
             when 'true_false' then a.text_answer = q.answer_key
             when 'short' then public.normalize_answer(a.text_answer) <> '' and exists (
               select 1 from regexp_split_to_table(q.answer_key, E'[\\n|]') k
               where public.normalize_answer(k) <> '' and public.normalize_answer(k) = public.normalize_answer(a.text_answer))
           end, false) as correct
    from public.quiz_answers a
    join public.quiz_questions q on q.id = a.question_id
    join public.quiz_question_items it on it.question_id = q.id and it.quiz_id = v_att.quiz_id
    where a.attempt_id = p_attempt_id and q.type <> 'essay'
  ) r
  where ans.id = r.id;

  update public.quiz_attempts set
    status = 'submitted',
    submitted_at = least(now(), deadline_at + interval '1 minute'),
    auto_submitted = p_auto,
    max_score = (select coalesce(sum(coalesce(it.points_override, q.points)), 0)
                 from public.quiz_question_items it join public.quiz_questions q on q.id = it.question_id
                 where it.quiz_id = v_att.quiz_id),
    score_auto = (select coalesce(sum(a.score), 0) from public.quiz_answers a
                  join public.quiz_questions q on q.id = a.question_id
                  where a.attempt_id = p_attempt_id and q.type <> 'essay'),
    -- Hanya esai yang dijawab yang perlu dinilai guru; esai kosong otomatis 0.
    needs_manual = exists (select 1 from public.quiz_answers a join public.quiz_questions q on q.id = a.question_id
                           where a.attempt_id = p_attempt_id and q.type = 'essay' and coalesce(trim(a.text_answer), '') <> '')
  where id = p_attempt_id;

  -- Selama esai belum dinilai, total sementara = nilai otomatis.
  update public.quiz_attempts set
    score_manual = case when needs_manual then null else 0 end,
    score_total = score_auto
  where id = p_attempt_id;
end;
$$;

-- Tutup otomatis percobaan yang waktunya sudah habis (dipanggil malas saat data diakses).
create or replace function public.finalize_expired_attempts(p_quiz_id uuid default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_n integer := 0;
begin
  for v_id in
    select id from public.quiz_attempts
    where status = 'in_progress' and deadline_at < now() - interval '30 seconds'
      and (p_quiz_id is null or quiz_id = p_quiz_id)
  loop
    perform public.finalize_attempt(v_id, true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.question_banks      enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.quiz_options        enable row level security;
alter table public.quizzes             enable row level security;
alter table public.quiz_question_items enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.quiz_answers        enable row level security;

drop policy if exists question_banks_all on public.question_banks;
create policy question_banks_all on public.question_banks for all to authenticated
  using (public.is_admin() or teacher_id = (select public.current_teacher_id()))
  with check (public.is_admin() or teacher_id = (select public.current_teacher_id()));

drop policy if exists quiz_questions_all on public.quiz_questions;
create policy quiz_questions_all on public.quiz_questions for all to authenticated
  using (public.owns_bank(bank_id)) with check (public.owns_bank(bank_id));

drop policy if exists quiz_options_all on public.quiz_options;
create policy quiz_options_all on public.quiz_options for all to authenticated
  using (public.owns_question(question_id)) with check (public.owns_question(question_id));

-- Kuis: metadata (bukan soal) boleh dibaca anggota kelas bila terbit.
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select to authenticated
  using (public.can_manage_ta(teaching_assignment_id) or (status = 'published' and public.can_view_ta(teaching_assignment_id)));
drop policy if exists quizzes_write on public.quizzes;
create policy quizzes_write on public.quizzes for all to authenticated
  using (public.can_manage_ta(teaching_assignment_id)) with check (public.can_manage_ta(teaching_assignment_id));

drop policy if exists quiz_question_items_all on public.quiz_question_items;
create policy quiz_question_items_all on public.quiz_question_items for all to authenticated
  using (public.can_manage_ta((select q.teaching_assignment_id from public.quizzes q where q.id = quiz_id)))
  with check (public.can_manage_ta((select q.teaching_assignment_id from public.quizzes q where q.id = quiz_id)));

-- Percobaan & jawaban: hanya guru/wali/admin yang membaca langsung; siswa lewat RPC.
drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (public.can_monitor_ta(teaching_assignment_id));
drop policy if exists quiz_answers_select on public.quiz_answers;
create policy quiz_answers_select on public.quiz_answers for select to authenticated
  using (public.can_monitor_ta((select a.teaching_assignment_id from public.quiz_attempts a where a.id = attempt_id)));

revoke all on public.question_banks, public.quiz_questions, public.quiz_options, public.quizzes,
  public.quiz_question_items, public.quiz_attempts, public.quiz_answers from anon;
grant select, insert, update, delete on public.question_banks, public.quiz_questions, public.quiz_options,
  public.quizzes, public.quiz_question_items to authenticated;
revoke all on public.quiz_attempts, public.quiz_answers from authenticated;
grant select on public.quiz_attempts, public.quiz_answers to authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa
-- ---------------------------------------------------------------------

-- Daftar kuis siswa (semester aktif) + ringkasan percobaannya.
create or replace function public.get_my_quizzes()
returns table (
  id uuid, teaching_assignment_id uuid, kind text, title text, description text,
  open_at timestamptz, close_at timestamptz, duration_minutes integer, max_attempts integer, show_score boolean,
  review_mode text, question_count integer, subject_name text, subject_code text, subject_color text, teacher_name text,
  attempts_used integer, in_progress_attempt_id uuid, last_attempt_id uuid, best_score numeric, max_score numeric,
  needs_manual boolean, server_now timestamptz
)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
begin
  -- Tutup percobaan milik siswa ini yang waktunya sudah habis.
  perform public.finalize_attempt(a.id, true)
  from public.quiz_attempts a
  where a.student_id = v_student and a.status = 'in_progress' and a.deadline_at < now() - interval '30 seconds';

  return query
  select q.id, q.teaching_assignment_id, q.kind, q.title, q.description, q.open_at, q.close_at,
         q.duration_minutes, q.max_attempts, q.show_score, q.review_mode::text,
         (select count(*) from public.quiz_question_items it where it.quiz_id = q.id)::int,
         sub.name, sub.code, sub.color, p.full_name,
         (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = v_student)::int,
         (select a.id from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = v_student and a.status = 'in_progress' limit 1),
         (select a.id from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = v_student and a.status = 'submitted' order by a.attempt_no desc limit 1),
         case when q.show_score then (select max(a.score_total) from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = v_student and a.status = 'submitted') end,
         (select coalesce(sum(coalesce(it.points_override, qq.points)), 0) from public.quiz_question_items it join public.quiz_questions qq on qq.id = it.question_id where it.quiz_id = q.id),
         exists (select 1 from public.quiz_attempts a where a.quiz_id = q.id and a.student_id = v_student and a.needs_manual),
         now()
  from public.quizzes q
  join public.teaching_assignments ta on ta.id = q.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.teachers t on t.id = ta.teacher_id
  join public.profiles p on p.id = t.profile_id
  where q.status = 'published'
    and ta.semester_id = public.active_semester_id()
    and ta.class_id in (select e.class_id from public.class_enrollments e where e.student_id = v_student)
  order by q.open_at desc;
end;
$$;

-- Mulai (atau lanjutkan) percobaan.
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_q public.quizzes;
  v_ta uuid;
  v_existing uuid;
  v_used integer;
  v_order jsonb;
  v_id uuid;
begin
  if v_student is null then
    raise exception 'Hanya siswa yang dapat mengerjakan kuis.' using errcode = '42501';
  end if;
  select q.* into v_q from public.quizzes q
  join public.teaching_assignments ta on ta.id = q.teaching_assignment_id
  join public.class_enrollments e on e.class_id = ta.class_id and e.student_id = v_student
  where q.id = p_quiz_id and q.status = 'published';
  if v_q.id is null then
    raise exception 'Kuis tidak ditemukan.' using errcode = 'P0002';
  end if;

  -- Kunci per siswa+kuis agar dua tab tidak membuat dua percobaan sekaligus.
  perform pg_advisory_xact_lock(hashtext(p_quiz_id::text || v_student::text));
  perform public.finalize_expired_attempts(p_quiz_id);

  select id into v_existing from public.quiz_attempts
  where quiz_id = p_quiz_id and student_id = v_student and status = 'in_progress';
  if v_existing is not null then
    return v_existing;
  end if;

  if now() < v_q.open_at then
    raise exception 'Kuis belum dibuka.' using errcode = '22023';
  end if;
  if now() >= v_q.close_at then
    raise exception 'Kuis sudah ditutup.' using errcode = '22023';
  end if;
  select count(*) into v_used from public.quiz_attempts where quiz_id = p_quiz_id and student_id = v_student;
  if v_used >= v_q.max_attempts then
    raise exception 'Batas percobaan (%) sudah habis.', v_q.max_attempts using errcode = '22023';
  end if;
  if not exists (select 1 from public.quiz_question_items where quiz_id = p_quiz_id) then
    raise exception 'Kuis belum memiliki soal.' using errcode = '22023';
  end if;

  -- Susunan soal & opsi (diacak bila diatur) disimpan per percobaan.
  select jsonb_agg(jsonb_build_object(
           'question_id', it.question_id,
           'option_ids', coalesce((
             select jsonb_agg(o.id order by case when v_q.shuffle_options then random() else o.position end, o.id)
             from public.quiz_options o where o.question_id = it.question_id), '[]'::jsonb))
         order by case when v_q.shuffle_questions then random() else it.position end, it.id)
    into v_order
  from public.quiz_question_items it where it.quiz_id = p_quiz_id;

  select ta.id into v_ta from public.teaching_assignments ta where ta.id = v_q.teaching_assignment_id;
  insert into public.quiz_attempts (quiz_id, student_id, teaching_assignment_id, attempt_no, deadline_at, question_order)
  values (p_quiz_id, v_student, v_ta, v_used + 1,
          least(now() + make_interval(mins => v_q.duration_minutes), v_q.close_at), v_order)
  returning id into v_id;
  return v_id;
end;
$$;

-- Riwayat percobaan siswa untuk satu kuis (nilai hanya bila guru menampilkan skor).
create or replace function public.get_my_quiz_attempts(p_quiz_id uuid)
returns table (
  id uuid, attempt_no integer, status text, started_at timestamptz, deadline_at timestamptz, submitted_at timestamptz,
  auto_submitted boolean, needs_manual boolean, score_total numeric, max_score numeric
)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
begin
  perform public.finalize_attempt(a.id, true)
  from public.quiz_attempts a
  where a.quiz_id = p_quiz_id and a.student_id = v_student and a.status = 'in_progress'
    and a.deadline_at < now() - interval '30 seconds';

  return query
  select a.id, a.attempt_no, a.status::text, a.started_at, a.deadline_at, a.submitted_at, a.auto_submitted, a.needs_manual,
         case when q.show_score then a.score_total end, a.max_score
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where a.quiz_id = p_quiz_id and a.student_id = v_student
  order by a.attempt_no desc;
end;
$$;

-- Soal untuk dikerjakan (TANPA kunci jawaban) + jawaban tersimpan + waktu server.
create or replace function public.get_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
  v_q public.quizzes;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id and student_id = public.current_student_id();
  if v_att.id is null then
    raise exception 'Percobaan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_att.status = 'in_progress' and v_att.deadline_at < now() - interval '30 seconds' then
    perform public.finalize_attempt(v_att.id, true);
    select * into v_att from public.quiz_attempts where id = p_attempt_id;
  end if;
  select * into v_q from public.quizzes where id = v_att.quiz_id;

  return jsonb_build_object(
    'id', v_att.id, 'quiz_id', v_q.id, 'title', v_q.title, 'kind', v_q.kind, 'attempt_no', v_att.attempt_no,
    'status', v_att.status, 'started_at', v_att.started_at, 'deadline_at', v_att.deadline_at,
    'server_now', now(), 'focus_lost_count', v_att.focus_lost_count,
    'questions', case when v_att.status = 'in_progress' then (
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'type', q.type, 'body', q.body, 'points', coalesce(it.points_override, q.points),
               'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by oi.ord), '[]'::jsonb)
                           from jsonb_array_elements_text(ord.item -> 'option_ids') with ordinality oi(oid, ord)
                           join public.quiz_options o on o.id = oi.oid::uuid),
               'answer', (select jsonb_build_object('option_id', a.selected_option_id, 'text', a.text_answer)
                          from public.quiz_answers a where a.attempt_id = v_att.id and a.question_id = q.id))
             order by ord.n)
      from jsonb_array_elements(v_att.question_order) with ordinality ord(item, n)
      join public.quiz_questions q on q.id = (ord.item ->> 'question_id')::uuid
      join public.quiz_question_items it on it.question_id = q.id and it.quiz_id = v_q.id
    ) else '[]'::jsonb end
  );
end;
$$;

-- Autosave satu jawaban (ditolak setelah waktu habis; toleransi jaringan 30 detik).
create or replace function public.save_quiz_answer(p_attempt_id uuid, p_question_id uuid, p_option_id uuid default null, p_text text default null)
returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
  v_type public.question_type;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id and student_id = public.current_student_id();
  if v_att.id is null then
    raise exception 'Percobaan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_att.status <> 'in_progress' then
    raise exception 'Kuis sudah dikumpulkan.' using errcode = '22023';
  end if;
  if now() > v_att.deadline_at + interval '30 seconds' then
    perform public.finalize_attempt(v_att.id, true);
    raise exception 'Waktu pengerjaan sudah habis.' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_att.question_order) x where (x ->> 'question_id')::uuid = p_question_id) then
    raise exception 'Soal tidak ada di kuis ini.' using errcode = '22023';
  end if;
  select type into v_type from public.quiz_questions where id = p_question_id;
  if v_type = 'mcq' and p_option_id is not null and not exists (
    select 1 from public.quiz_options where id = p_option_id and question_id = p_question_id) then
    raise exception 'Pilihan jawaban tidak valid.' using errcode = '22023';
  end if;
  if v_type = 'true_false' and p_text is not null and p_text not in ('true', 'false') then
    raise exception 'Jawaban benar/salah tidak valid.' using errcode = '22023';
  end if;

  insert into public.quiz_answers (attempt_id, question_id, selected_option_id, text_answer, updated_at)
  values (p_attempt_id, p_question_id, case when v_type = 'mcq' then p_option_id end,
          case when v_type <> 'mcq' then left(p_text, 10000) end, now())
  on conflict (attempt_id, question_id) do update set
    selected_option_id = excluded.selected_option_id, text_answer = excluded.text_answer, updated_at = now();
  return now();
end;
$$;

create or replace function public.submit_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.quiz_attempts where id = p_attempt_id and student_id = public.current_student_id()) then
    raise exception 'Percobaan tidak ditemukan.' using errcode = 'P0002';
  end if;
  -- Dikumpulkan setelah batas waktu (mis. timer habis di HP) dicatat sebagai otomatis.
  perform public.finalize_attempt(p_attempt_id, now() >= (select deadline_at from public.quiz_attempts where id = p_attempt_id));
  return (select jsonb_build_object('status', status, 'submitted_at', submitted_at) from public.quiz_attempts where id = p_attempt_id);
end;
$$;

-- Catat perpindahan tab/aplikasi selama ujian (informasi untuk guru, bukan hukuman otomatis).
create or replace function public.report_focus_lost(p_attempt_id uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.quiz_attempts set focus_lost_count = focus_lost_count + 1
  where id = p_attempt_id and student_id = public.current_student_id() and status = 'in_progress';
$$;

-- Hasil percobaan untuk siswa. Kunci & pembahasan hanya bila review_mode mengizinkan.
create or replace function public.get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
  v_q public.quizzes;
  v_review boolean;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id and student_id = public.current_student_id();
  if v_att.id is null then
    raise exception 'Percobaan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_att.status = 'in_progress' then
    if v_att.deadline_at < now() - interval '30 seconds' then
      perform public.finalize_attempt(v_att.id, true);
      select * into v_att from public.quiz_attempts where id = p_attempt_id;
    else
      raise exception 'Kuis masih dikerjakan.' using errcode = '22023';
    end if;
  end if;
  select * into v_q from public.quizzes where id = v_att.quiz_id;
  v_review := v_q.review_mode = 'after_submit' or (v_q.review_mode = 'after_close' and now() >= v_q.close_at);

  return jsonb_build_object(
    'id', v_att.id, 'quiz_id', v_q.id, 'title', v_q.title, 'attempt_no', v_att.attempt_no,
    'submitted_at', v_att.submitted_at, 'auto_submitted', v_att.auto_submitted,
    'show_score', v_q.show_score, 'needs_manual', v_att.needs_manual,
    'score_total', case when v_q.show_score then v_att.score_total end,
    'max_score', v_att.max_score,
    'review_available', v_review, 'review_mode', v_q.review_mode, 'close_at', v_q.close_at,
    'answered', (select count(*) from public.quiz_answers a where a.attempt_id = v_att.id
                 and (a.selected_option_id is not null or coalesce(trim(a.text_answer), '') <> '')),
    'total', jsonb_array_length(v_att.question_order),
    'review', case when v_review then (
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'type', q.type, 'body', q.body, 'points', coalesce(it.points_override, q.points),
               'explanation', q.explanation,
               'answer_key', case when q.type in ('true_false', 'short') then q.answer_key end,
               'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body, 'is_correct', o.is_correct) order by oi.ord), '[]'::jsonb)
                           from jsonb_array_elements_text(ord.item -> 'option_ids') with ordinality oi(oid, ord)
                           join public.quiz_options o on o.id = oi.oid::uuid),
               'my_option_id', a.selected_option_id, 'my_text', a.text_answer,
               'is_correct', a.is_correct, 'score', case when v_q.show_score then a.score end)
             order by ord.n)
      from jsonb_array_elements(v_att.question_order) with ordinality ord(item, n)
      join public.quiz_questions q on q.id = (ord.item ->> 'question_id')::uuid
      join public.quiz_question_items it on it.question_id = q.id and it.quiz_id = v_q.id
      left join public.quiz_answers a on a.attempt_id = v_att.id and a.question_id = q.id
    ) end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC guru
-- ---------------------------------------------------------------------

-- Ringkasan kuis per ruang kelas.
create or replace function public.get_course_quizzes(p_ta_id uuid)
returns table (
  id uuid, title text, kind text, status text, open_at timestamptz, close_at timestamptz, duration_minutes integer,
  question_count integer, max_score numeric, student_count integer, participants integer, in_progress integer,
  needs_manual integer, avg_score numeric
)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.can_monitor_ta(p_ta_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  perform public.finalize_expired_attempts(q.id) from public.quizzes q where q.teaching_assignment_id = p_ta_id;
  return query
  select q.id, q.title, q.kind, q.status::text, q.open_at, q.close_at, q.duration_minutes,
         (select count(*) from public.quiz_question_items it where it.quiz_id = q.id)::int,
         (select coalesce(sum(coalesce(it.points_override, qq.points)), 0) from public.quiz_question_items it join public.quiz_questions qq on qq.id = it.question_id where it.quiz_id = q.id),
         (select count(*) from public.class_enrollments e join public.teaching_assignments ta on ta.class_id = e.class_id where ta.id = p_ta_id)::int,
         (select count(distinct a.student_id) from public.quiz_attempts a where a.quiz_id = q.id)::int,
         (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.status = 'in_progress')::int,
         (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.needs_manual)::int,
         (select round(avg(best), 2) from (select max(a.score_total) best from public.quiz_attempts a where a.quiz_id = q.id and a.status = 'submitted' group by a.student_id) b)
  from public.quizzes q
  where q.teaching_assignment_id = p_ta_id and (q.status = 'published' or public.can_manage_ta(p_ta_id))
  order by q.open_at desc;
end;
$$;

-- Hasil per siswa untuk satu kuis (nilai terbaik + percobaan terakhir).
create or replace function public.get_quiz_results(p_quiz_id uuid)
returns table (
  student_id uuid, full_name text, nisn text, attempts integer, best_score numeric, max_score numeric,
  last_attempt_id uuid, last_status text, last_submitted_at timestamptz, needs_manual boolean,
  focus_lost integer, auto_submitted boolean
)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ta uuid;
begin
  select teaching_assignment_id into v_ta from public.quizzes where id = p_quiz_id;
  if v_ta is null or not public.can_monitor_ta(v_ta) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  perform public.finalize_expired_attempts(p_quiz_id);
  return query
  select st.id, p.full_name, st.nisn,
         (select count(*) from public.quiz_attempts a where a.quiz_id = p_quiz_id and a.student_id = st.id)::int,
         (select max(a.score_total) from public.quiz_attempts a where a.quiz_id = p_quiz_id and a.student_id = st.id and a.status = 'submitted'),
         (select max(a.max_score) from public.quiz_attempts a where a.quiz_id = p_quiz_id and a.student_id = st.id),
         l.id, l.status::text, l.submitted_at, coalesce(l.needs_manual, false), coalesce(l.focus_lost_count, 0), coalesce(l.auto_submitted, false)
  from public.teaching_assignments ta
  join public.class_enrollments e on e.class_id = ta.class_id
  join public.students st on st.id = e.student_id
  join public.profiles p on p.id = st.profile_id
  left join lateral (
    select a.* from public.quiz_attempts a where a.quiz_id = p_quiz_id and a.student_id = st.id order by a.attempt_no desc limit 1
  ) l on true
  where ta.id = v_ta
  order by p.full_name;
end;
$$;

-- Detail satu percobaan untuk guru (termasuk kunci & jawaban siswa).
create or replace function public.get_attempt_detail(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id;
  if v_att.id is null or not public.can_monitor_ta(v_att.teaching_assignment_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', v_att.id, 'status', v_att.status, 'attempt_no', v_att.attempt_no, 'started_at', v_att.started_at,
    'submitted_at', v_att.submitted_at, 'score_auto', v_att.score_auto, 'score_manual', v_att.score_manual,
    'score_total', v_att.score_total, 'max_score', v_att.max_score, 'needs_manual', v_att.needs_manual,
    'focus_lost_count', v_att.focus_lost_count, 'auto_submitted', v_att.auto_submitted,
    'student_name', (select p.full_name from public.students s join public.profiles p on p.id = s.profile_id where s.id = v_att.student_id),
    'questions', (
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'type', q.type, 'body', q.body, 'points', coalesce(it.points_override, q.points),
               'answer_key', q.answer_key,
               'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body, 'is_correct', o.is_correct) order by o.position), '[]'::jsonb)
                           from public.quiz_options o where o.question_id = q.id),
               'answer_id', a.id, 'my_option_id', a.selected_option_id, 'my_text', a.text_answer,
               'is_correct', a.is_correct, 'score', a.score)
             order by ord.n)
      from jsonb_array_elements(v_att.question_order) with ordinality ord(item, n)
      join public.quiz_questions q on q.id = (ord.item ->> 'question_id')::uuid
      join public.quiz_question_items it on it.question_id = q.id and it.quiz_id = v_att.quiz_id
      left join public.quiz_answers a on a.attempt_id = v_att.id and a.question_id = q.id
    )
  );
end;
$$;

-- Guru menilai satu soal esai; total percobaan dihitung ulang.
create or replace function public.grade_essay(p_attempt_id uuid, p_question_id uuid, p_score numeric)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
  v_pts numeric;
  v_old numeric;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id;
  if v_att.id is null or not public.can_manage_ta(v_att.teaching_assignment_id) then
    raise exception 'Hanya guru pengampu yang dapat menilai.' using errcode = '42501';
  end if;
  if v_att.status <> 'submitted' then
    raise exception 'Percobaan belum dikumpulkan.' using errcode = '22023';
  end if;
  select coalesce(it.points_override, q.points) into v_pts
  from public.quiz_questions q join public.quiz_question_items it on it.question_id = q.id and it.quiz_id = v_att.quiz_id
  where q.id = p_question_id and q.type = 'essay';
  if v_pts is null then
    raise exception 'Soal esai tidak ditemukan pada kuis ini.' using errcode = 'P0002';
  end if;
  if p_score < 0 or p_score > v_pts then
    raise exception 'Nilai harus antara 0 dan %.', v_pts using errcode = '22023';
  end if;

  select score into v_old from public.quiz_answers where attempt_id = p_attempt_id and question_id = p_question_id;
  insert into public.quiz_answers (attempt_id, question_id, score, graded_by)
  values (p_attempt_id, p_question_id, p_score, auth.uid())
  on conflict (attempt_id, question_id) do update set score = excluded.score, graded_by = excluded.graded_by;

  update public.quiz_attempts a set
    score_manual = (select coalesce(sum(ans.score), 0) from public.quiz_answers ans join public.quiz_questions q on q.id = ans.question_id
                    where ans.attempt_id = a.id and q.type = 'essay'),
    needs_manual = exists (
      select 1 from public.quiz_answers ans join public.quiz_questions q on q.id = ans.question_id
      where ans.attempt_id = a.id and q.type = 'essay' and ans.score is null and coalesce(trim(ans.text_answer), '') <> '')
  where a.id = p_attempt_id;
  update public.quiz_attempts set score_total = coalesce(score_auto, 0) + coalesce(score_manual, 0) where id = p_attempt_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'quiz_answers.grade', 'quiz_attempts', p_attempt_id::text,
          jsonb_build_object('question_id', p_question_id, 'old', v_old, 'new', p_score));

  return (select jsonb_build_object('score_total', score_total, 'needs_manual', needs_manual) from public.quiz_attempts where id = p_attempt_id);
end;
$$;

-- Antrean penilaian esai kuis milik guru (semester aktif).
create or replace function public.get_quiz_grading_queue()
returns table (
  quiz_id uuid, teaching_assignment_id uuid, title text, subject_name text, subject_color text, class_name text,
  waiting integer, close_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select q.id, q.teaching_assignment_id, q.title, sub.name, sub.color, c.name,
         count(*)::int, q.close_at
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  join public.teaching_assignments ta on ta.id = q.teaching_assignment_id
  join public.subjects sub on sub.id = ta.subject_id
  join public.classes c on c.id = ta.class_id
  where a.status = 'submitted' and a.needs_manual
    and ta.semester_id = public.active_semester_id()
    and (ta.teacher_id = public.current_teacher_id() or public.is_admin())
  group by q.id, sub.name, sub.color, c.name
  order by min(a.submitted_at)
$$;

-- Izinkan satu siswa mengulang (hapus percobaan terakhirnya) — mis. kendala teknis.
create or replace function public.reset_quiz_attempt(p_attempt_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_att public.quiz_attempts;
begin
  select * into v_att from public.quiz_attempts where id = p_attempt_id;
  if v_att.id is null or not public.can_manage_ta(v_att.teaching_assignment_id) then
    raise exception 'Hanya guru pengampu yang dapat mengatur ulang percobaan.' using errcode = '42501';
  end if;
  delete from public.quiz_attempts where id = p_attempt_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'quiz_attempts.reset', 'quiz_attempts', p_attempt_id::text,
          jsonb_build_object('quiz_id', v_att.quiz_id, 'student_id', v_att.student_id, 'score_total', v_att.score_total));
end;
$$;

-- ---------------------------------------------------------------------
-- Hak eksekusi
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'owns_bank(uuid)', 'owns_question(uuid)', 'get_my_quizzes()', 'start_quiz_attempt(uuid)', 'get_attempt(uuid)',
    'save_quiz_answer(uuid, uuid, uuid, text)', 'submit_quiz_attempt(uuid)', 'report_focus_lost(uuid)',
    'get_attempt_result(uuid)', 'get_my_quiz_attempts(uuid)', 'get_quiz_grading_queue()', 'get_course_quizzes(uuid)', 'get_quiz_results(uuid)', 'get_attempt_detail(uuid)',
    'grade_essay(uuid, uuid, numeric)', 'reset_quiz_attempt(uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end$$;

-- Fungsi internal: tidak boleh dipanggil langsung oleh pengguna.
revoke execute on function public.finalize_attempt(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.finalize_expired_attempts(uuid) from public, anon, authenticated;
revoke execute on function public.normalize_answer(text) from public, anon;
revoke execute on function public.quizzes_before_write() from public, anon, authenticated;
revoke execute on function public.quiz_items_check() from public, anon, authenticated;
revoke execute on function public.quiz_items_before_delete() from public, anon, authenticated;
revoke execute on function public.audit_quiz_change() from public, anon, authenticated;
revoke execute on function public.quiz_question_lock() from public, anon, authenticated;
revoke execute on function public.question_in_attempted_quiz(uuid) from public, anon;
grant execute on function public.question_in_attempted_quiz(uuid) to authenticated;
