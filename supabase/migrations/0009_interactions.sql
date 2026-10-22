-- =====================================================================
-- 0009 — Interaksi: notifikasi, pengumuman, forum diskusi, kalender
-- Tahap 6 (Interaksi)
--
-- Prinsip:
--  * Notifikasi dibuat oleh trigger/fungsi server (fan-out ke siswa kelas terkait),
--    tidak pernah ditulis langsung oleh pengguna. notify_at memungkinkan
--    notifikasi terjadwal (pengumuman/kuis yang dibuka nanti) tanpa pg_cron.
--  * Pengingat tenggat dibuat "malas" saat siswa membuka notifikasinya.
--  * Isi forum berupa teks biasa (bukan HTML) agar aman dari XSS.
--  * Realtime hanya untuk tabel notifications (satu channel per pengguna).
-- =====================================================================

-- Preferensi notifikasi sekolah: tambahkan kunci baru tanpa menimpa pilihan admin.
update public.school_settings
set notification_prefs = '{"new_quiz":true,"forum":true}'::jsonb || notification_prefs;
alter table public.school_settings
  alter column notification_prefs set default
  '{"new_material":true,"new_assignment":true,"new_quiz":true,"deadline_reminder":true,"grade_published":true,"announcement":true,"forum":true}'::jsonb;

-- =====================================================================
-- NOTIFIKASI
-- =====================================================================
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,   -- material | assignment | quiz | deadline | grade | announcement | forum | badge
  title       text not null,
  body        text,
  link        text,
  ref_id      uuid,            -- objek terkait; mencegah notifikasi ganda
  notify_at   timestamptz not null default now(),
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint notifications_title_len check (char_length(title) between 1 and 200)
);
create unique index if not exists notifications_dedup_idx on public.notifications (user_id, type, ref_id) where ref_id is not null;
create index if not exists notifications_user_idx on public.notifications (user_id, notify_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and notify_at <= now());
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Apakah jenis notifikasi diaktifkan admin (Pengaturan Sekolah → Notifikasi).
create or replace function public.notification_enabled(p_type text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select (s.notification_prefs ->> case p_type
              when 'material' then 'new_material'
              when 'assignment' then 'new_assignment'
              when 'quiz' then 'new_quiz'
              when 'deadline' then 'deadline_reminder'
              when 'grade' then 'grade_published'
              when 'announcement' then 'announcement'
              when 'forum' then 'forum'
              else null end)::boolean
    from public.school_settings s), true)
$$;

-- Kirim notifikasi ke banyak pengguna sekaligus (internal).
create or replace function public.notify_users(
  p_user_ids uuid[], p_type text, p_title text, p_body text, p_link text, p_ref_id uuid,
  p_notify_at timestamptz default now()
)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 or not public.notification_enabled(p_type) then
    return 0;
  end if;
  insert into public.notifications (user_id, type, title, body, link, ref_id, notify_at)
  select distinct u, p_type, left(p_title, 200), left(p_body, 500), p_link, p_ref_id, coalesce(p_notify_at, now())
  from unnest(p_user_ids) u
  join public.profiles p on p.id = u and p.is_active
  where u is distinct from auth.uid()   -- pembuat tidak menerima notifikasi tindakannya sendiri
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Akun siswa aktif di kelas tertentu.
create or replace function public.class_student_users(p_class_id uuid)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(s.profile_id), '{}')
  from public.class_enrollments e
  join public.students s on s.id = e.student_id and s.status = 'active'
  where e.class_id = p_class_id
$$;

create or replace function public.ta_student_users(p_ta_id uuid)
returns uuid[] language sql stable security definer set search_path = ''
as $$ select public.class_student_users((select class_id from public.teaching_assignments where id = p_ta_id)) $$;

create or replace function public.ta_label(p_ta_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select sub.name || ' · ' || c.name
  from public.teaching_assignments ta
  join public.subjects sub on sub.id = ta.subject_id
  join public.classes c on c.id = ta.class_id
  where ta.id = p_ta_id
$$;

-- Format waktu WIB singkat untuk isi notifikasi.
create or replace function public.wib(p timestamptz)
returns text language sql immutable set search_path = ''
as $$ select to_char(p at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') || ' WIB' $$;

-- ---------- Trigger: materi, tugas, nilai, kuis ----------
create or replace function public.notify_on_lesson()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.notify_users(public.ta_student_users(new.teaching_assignment_id), 'material',
      'Materi baru: ' || new.title, public.ta_label(new.teaching_assignment_id),
      '/siswa/mapel/' || new.teaching_assignment_id || '/pertemuan/' || new.id, new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists lessons_notify on public.lessons;
create trigger lessons_notify after insert or update of status on public.lessons
  for each row execute function public.notify_on_lesson();

create or replace function public.notify_on_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.notify_users(public.ta_student_users(new.teaching_assignment_id), 'assignment',
      'Tugas baru: ' || new.title, public.ta_label(new.teaching_assignment_id) || ' · tenggat ' || public.wib(new.due_at),
      '/siswa/tugas/' || new.id, new.id, greatest(now(), new.start_at));
  end if;
  return null;
end;
$$;
drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify after insert or update of status on public.assignments
  for each row execute function public.notify_on_assignment();

create or replace function public.notify_on_grade()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_title text;
begin
  if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
    select title into v_title from public.assignments where id = new.assignment_id;
    perform public.notify_users(array[(select profile_id from public.students where id = new.student_id)], 'grade',
      'Nilai tugas keluar: ' || v_title, public.ta_label(new.teaching_assignment_id),
      '/siswa/tugas/' || new.assignment_id, new.assignment_id);
  end if;
  return null;
end;
$$;
drop trigger if exists assignment_grades_notify on public.assignment_grades;
create trigger assignment_grades_notify after insert or update of published_at on public.assignment_grades
  for each row execute function public.notify_on_grade();

create or replace function public.notify_on_quiz()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.notify_users(public.ta_student_users(new.teaching_assignment_id), 'quiz',
      case new.kind when 'exam' then 'Ujian baru: ' else 'Kuis baru: ' end || new.title,
      public.ta_label(new.teaching_assignment_id) || ' · dibuka ' || public.wib(new.open_at),
      '/siswa/kuis/' || new.id, new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists quizzes_notify on public.quizzes;
create trigger quizzes_notify after insert or update of status on public.quizzes
  for each row execute function public.notify_on_quiz();

-- Nilai kuis lengkap setelah esai dinilai.
create or replace function public.notify_on_quiz_graded()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_title text;
begin
  if old.needs_manual and not new.needs_manual and new.status = 'submitted' then
    select title into v_title from public.quizzes where id = new.quiz_id;
    perform public.notify_users(array[(select profile_id from public.students where id = new.student_id)], 'grade',
      'Nilai kuis lengkap: ' || v_title, 'Jawaban esaimu sudah dinilai guru.',
      '/siswa/kuis/' || new.quiz_id || '/hasil/' || new.id, new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists quiz_attempts_notify on public.quiz_attempts;
create trigger quiz_attempts_notify after update of needs_manual on public.quiz_attempts
  for each row execute function public.notify_on_quiz_graded();

-- ---------- RPC notifikasi ----------
-- Pengingat H-1 (tugas belum dikumpulkan & kuis belum dikerjakan) dibuat saat dibutuhkan.
create or replace function public.generate_my_reminders()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_user uuid := auth.uid();
begin
  if v_student is null or not public.notification_enabled('deadline') then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link, ref_id, notify_at)
  select v_user, 'deadline', 'Tenggat besok: ' || a.title,
         public.ta_label(a.teaching_assignment_id) || ' · tenggat ' || public.wib(a.due_at),
         '/siswa/tugas/' || a.id, a.id, greatest(a.due_at - interval '24 hours', a.start_at)
  from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id and ta.semester_id = public.active_semester_id()
  join public.class_enrollments e on e.class_id = ta.class_id and e.student_id = v_student
  where a.status = 'published' and a.due_at > now() and a.due_at <= now() + interval '24 hours'
    and not exists (select 1 from public.assignment_submissions s
                    where s.assignment_id = a.id and s.student_id = v_student and s.status = 'submitted')
  on conflict do nothing;

  insert into public.notifications (user_id, type, title, body, link, ref_id, notify_at)
  select v_user, 'deadline', case q.kind when 'exam' then 'Ujian segera ditutup: ' else 'Kuis segera ditutup: ' end || q.title,
         public.ta_label(q.teaching_assignment_id) || ' · ditutup ' || public.wib(q.close_at),
         '/siswa/kuis/' || q.id, q.id, greatest(q.close_at - interval '24 hours', q.open_at)
  from public.quizzes q
  join public.teaching_assignments ta on ta.id = q.teaching_assignment_id and ta.semester_id = public.active_semester_id()
  join public.class_enrollments e on e.class_id = ta.class_id and e.student_id = v_student
  where q.status = 'published' and q.open_at <= now() and q.close_at > now() and q.close_at <= now() + interval '24 hours'
    and not exists (select 1 from public.quiz_attempts at where at.quiz_id = q.id and at.student_id = v_student)
  on conflict do nothing;
end;
$$;

create or replace function public.get_my_notifications(p_limit integer default 20, p_before bigint default null)
returns table (
  id bigint, type text, title text, body text, link text, notify_at timestamptz, read_at timestamptz, unread_total integer
)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.generate_my_reminders();
  -- Bersihkan notifikasi lama yang sudah dibaca (> 120 hari).
  delete from public.notifications n
  where n.user_id = auth.uid() and n.read_at is not null and n.notify_at < now() - interval '120 days';

  return query
  select n.id, n.type, n.title, n.body, n.link, n.notify_at, n.read_at,
         (select count(*) from public.notifications u where u.user_id = auth.uid() and u.read_at is null and u.notify_at <= now())::int
  from public.notifications n
  where n.user_id = auth.uid() and n.notify_at <= now() and (p_before is null or n.id < p_before)
  order by n.notify_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- Tandai dibaca: daftar id tertentu, atau semua bila p_ids null.
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and notify_at <= now()
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Realtime: kirim baris notifikasi baru ke pemiliknya (RLS tetap berlaku).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end$$;

-- =====================================================================
-- PENGUMUMAN
-- =====================================================================
create table if not exists public.announcements (
  id                      uuid primary key default gen_random_uuid(),
  scope                   text not null,          -- school | class | course
  class_id                uuid references public.classes (id) on delete cascade,
  teaching_assignment_id  uuid references public.teaching_assignments (id) on delete cascade,
  title                   text not null,
  body_html               text,
  author_id               uuid references public.profiles (id) on delete set null default auth.uid(),
  publish_at              timestamptz not null default now(),
  expires_at              timestamptz,
  is_pinned               boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint announcements_scope check (
    (scope = 'school' and class_id is null and teaching_assignment_id is null)
    or (scope = 'class' and class_id is not null and teaching_assignment_id is null)
    or (scope = 'course' and teaching_assignment_id is not null and class_id is null)),
  constraint announcements_title_len check (char_length(title) between 1 and 200),
  constraint announcements_body_size check (body_html is null or octet_length(body_html) <= 100000),
  constraint announcements_expiry check (expires_at is null or expires_at > publish_at)
);
create index if not exists announcements_publish_idx on public.announcements (publish_at desc);
create index if not exists announcements_class_idx on public.announcements (class_id) where class_id is not null;
create index if not exists announcements_ta_idx on public.announcements (teaching_assignment_id) where teaching_assignment_id is not null;

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

-- Boleh membuat/mengubah pengumuman dengan cakupan ini.
create or replace function public.can_manage_announcement(p_scope text, p_class_id uuid, p_ta_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or case p_scope
    when 'class' then public.guards_class(p_class_id)
    when 'course' then public.can_manage_ta(p_ta_id)
    else false end
$$;

-- Boleh membaca pengumuman dengan cakupan ini (tanpa memperhatikan jadwal tayang).
create or replace function public.can_read_announcement(p_scope text, p_class_id uuid, p_ta_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or case p_scope
    when 'school' then true
    when 'class' then public.student_in_class(p_class_id) or public.guards_class(p_class_id) or public.teaches_class(p_class_id)
    when 'course' then public.can_view_ta(p_ta_id)
    else false end
$$;

create or replace function public.announcements_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
  elsif new.scope is distinct from old.scope or new.class_id is distinct from old.class_id
        or new.teaching_assignment_id is distinct from old.teaching_assignment_id then
    raise exception 'Cakupan pengumuman tidak dapat diubah. Buat pengumuman baru.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists announcements_before_write on public.announcements;
create trigger announcements_before_write before insert or update on public.announcements
  for each row execute function public.announcements_before_write();

create or replace function public.notify_on_announcement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_users uuid[];
  v_where text;
begin
  if new.expires_at is not null and new.expires_at <= now() then
    return null;   -- sudah kedaluwarsa saat dibuat: tidak perlu diberitahukan
  end if;
  if new.scope = 'school' then
    select coalesce(array_agg(id), '{}') into v_users from public.profiles where is_active;
    v_where := 'Pengumuman sekolah';
  elsif new.scope = 'class' then
    v_users := public.class_student_users(new.class_id);
    v_where := 'Pengumuman kelas ' || (select name from public.classes where id = new.class_id);
  else
    v_users := public.ta_student_users(new.teaching_assignment_id);
    v_where := public.ta_label(new.teaching_assignment_id);
  end if;
  perform public.notify_users(v_users, 'announcement', new.title, v_where, '/pengumuman/' || new.id, new.id, new.publish_at);
  return null;
end;
$$;
drop trigger if exists announcements_notify on public.announcements;
create trigger announcements_notify after insert on public.announcements
  for each row execute function public.notify_on_announcement();

-- Jadwal tayang diubah → sesuaikan waktu notifikasi yang belum tampil.
create or replace function public.announcements_after_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.publish_at is distinct from old.publish_at then
    update public.notifications set notify_at = new.publish_at
    where type = 'announcement' and ref_id = new.id and read_at is null;
  end if;
  return null;
end;
$$;
drop trigger if exists announcements_after_update on public.announcements;
create trigger announcements_after_update after update of publish_at on public.announcements
  for each row execute function public.announcements_after_update();

create or replace function public.audit_announcement_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'announcements.delete', 'announcements', old.id::text,
          jsonb_build_object('title', old.title, 'scope', old.scope));
  delete from public.notifications where type = 'announcement' and ref_id = old.id;
  return old;
end;
$$;
drop trigger if exists announcements_audit_delete on public.announcements;
create trigger announcements_audit_delete after delete on public.announcements
  for each row execute function public.audit_announcement_delete();

alter table public.announcements enable row level security;
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (
    public.can_manage_announcement(scope, class_id, teaching_assignment_id)
    or author_id = (select auth.uid())
    or (publish_at <= now() and (expires_at is null or expires_at > now())
        and public.can_read_announcement(scope, class_id, teaching_assignment_id))
  );
drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.can_manage_announcement(scope, class_id, teaching_assignment_id));
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.can_manage_announcement(scope, class_id, teaching_assignment_id))
  with check (public.can_manage_announcement(scope, class_id, teaching_assignment_id));
drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.can_manage_announcement(scope, class_id, teaching_assignment_id));
revoke all on public.announcements from anon;
grant select, insert, update, delete on public.announcements to authenticated;

-- Daftar pengumuman yang terlihat oleh pengguna (dengan nama penulis & target).
create or replace function public.get_announcements(
  p_ta_id uuid default null, p_include_scheduled boolean default false, p_limit integer default 50, p_id uuid default null
)
returns table (
  id uuid, scope text, class_id uuid, teaching_assignment_id uuid, title text, body_html text,
  author_id uuid, author_name text, target_label text, publish_at timestamptz, expires_at timestamptz,
  is_pinned boolean, can_manage boolean, is_scheduled boolean, is_expired boolean
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.scope, a.class_id, a.teaching_assignment_id, a.title, a.body_html,
         a.author_id, p.full_name,
         case a.scope when 'school' then 'Seluruh sekolah'
                      when 'class' then 'Kelas ' || c.name
                      else public.ta_label(a.teaching_assignment_id) end,
         a.publish_at, a.expires_at, a.is_pinned,
         public.can_manage_announcement(a.scope, a.class_id, a.teaching_assignment_id),
         a.publish_at > now(), a.expires_at is not null and a.expires_at <= now()
  from public.announcements a
  left join public.profiles p on p.id = a.author_id
  left join public.classes c on c.id = a.class_id
  where (p_id is null or a.id = p_id)
    and (p_ta_id is null or a.teaching_assignment_id = p_ta_id
         or (a.scope = 'class' and a.class_id = (select class_id from public.teaching_assignments where id = p_ta_id)))
    and (
      (public.can_read_announcement(a.scope, a.class_id, a.teaching_assignment_id)
        and a.publish_at <= now() and (a.expires_at is null or a.expires_at > now()))
      or (p_include_scheduled and (a.author_id = auth.uid() or public.can_manage_announcement(a.scope, a.class_id, a.teaching_assignment_id)))
    )
    -- Kelas lama (tahun pelajaran lalu) tidak lagi ditampilkan ke siswa.
    and (a.scope <> 'class' or public.is_admin() or c.academic_year_id = public.active_academic_year_id())
  order by a.is_pinned and (a.expires_at is null or a.expires_at > now()) desc, a.publish_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

-- Target pengumuman yang boleh dipilih pengguna ini.
create or replace function public.get_announcement_targets()
returns table (scope text, id uuid, label text)
language sql stable security definer set search_path = ''
as $$
  select 'school', null::uuid, 'Seluruh sekolah' where public.is_admin()
  union all
  select 'class', c.id, 'Kelas ' || c.name
  from public.classes c
  where c.academic_year_id = public.active_academic_year_id() and (public.is_admin() or public.guards_class(c.id))
  union all
  select 'course', ta.id, public.ta_label(ta.id)
  from public.teaching_assignments ta
  where ta.semester_id = public.active_semester_id() and ta.teacher_id = public.current_teacher_id()
  order by 1 desc, 3
$$;

-- =====================================================================
-- FORUM DISKUSI
-- =====================================================================
create table if not exists public.discussion_topics (
  id                      uuid primary key default gen_random_uuid(),
  teaching_assignment_id  uuid not null references public.teaching_assignments (id) on delete cascade,
  author_id               uuid references public.profiles (id) on delete set null default auth.uid(),
  title                   text not null,
  body                    text not null,
  is_pinned               boolean not null default false,
  is_locked               boolean not null default false,
  is_hidden               boolean not null default false,
  hidden_by               uuid references public.profiles (id) on delete set null,
  reply_count             integer not null default 0,
  last_activity_at        timestamptz not null default now(),
  edited_at               timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint discussion_topics_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint discussion_topics_body_len check (char_length(btrim(body)) between 1 and 5000)
);
create index if not exists discussion_topics_ta_idx on public.discussion_topics (teaching_assignment_id, is_pinned desc, last_activity_at desc);

create table if not exists public.discussion_replies (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.discussion_topics (id) on delete cascade,
  parent_id   uuid references public.discussion_replies (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  body        text not null,
  is_hidden   boolean not null default false,
  hidden_by   uuid references public.profiles (id) on delete set null,
  edited_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint discussion_replies_body_len check (char_length(btrim(body)) between 1 and 3000)
);
create index if not exists discussion_replies_topic_idx on public.discussion_replies (topic_id, created_at);

drop trigger if exists discussion_topics_set_updated_at on public.discussion_topics;
create trigger discussion_topics_set_updated_at before update on public.discussion_topics
  for each row execute function public.set_updated_at();
drop trigger if exists discussion_replies_set_updated_at on public.discussion_replies;
create trigger discussion_replies_set_updated_at before update on public.discussion_replies
  for each row execute function public.set_updated_at();

create or replace function public.topic_ta(p_topic_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select teaching_assignment_id from public.discussion_topics where id = p_topic_id $$;

-- Batas kecepatan menulis: maksimal 6 tulisan per menit per pengguna.
create or replace function public.forum_rate_limit()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_admin() then return; end if;
  if (select count(*) from public.discussion_topics where author_id = auth.uid() and created_at > now() - interval '1 minute')
     + (select count(*) from public.discussion_replies where author_id = auth.uid() and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Terlalu banyak tulisan dalam waktu singkat. Tunggu sebentar lalu coba lagi.' using errcode = '22023';
  end if;
end;
$$;

-- Penjaga topik: hanya pengelola kelas yang boleh mengubah pin/kunci/sembunyikan.
create or replace function public.discussion_topics_before_write()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_manager boolean := public.can_manage_ta(coalesce(new.teaching_assignment_id, old.teaching_assignment_id));
begin
  if tg_op = 'INSERT' then
    perform public.forum_rate_limit();
    new.author_id := auth.uid();
    new.title := btrim(new.title);
    new.body := btrim(new.body);
    new.reply_count := 0;
    new.last_activity_at := now();
    new.edited_at := null;
    if not v_manager then
      new.is_pinned := false; new.is_locked := false; new.is_hidden := false;
    end if;
    new.hidden_by := case when new.is_hidden then auth.uid() end;
    return new;
  end if;

  if new.teaching_assignment_id <> old.teaching_assignment_id or new.author_id is distinct from old.author_id then
    raise exception 'Topik tidak dapat dipindahkan.' using errcode = '23514';
  end if;
  if not v_manager then
    if (new.is_pinned, new.is_locked, new.is_hidden) is distinct from (old.is_pinned, old.is_locked, old.is_hidden) then
      raise exception 'Hanya guru pengampu yang dapat memoderasi diskusi.' using errcode = '42501';
    end if;
  end if;
  if (new.title, new.body) is distinct from (old.title, old.body) then
    if old.author_id is distinct from auth.uid() then
      raise exception 'Hanya penulis yang dapat mengubah isi topik.' using errcode = '42501';
    end if;
    if old.is_locked and not v_manager then
      raise exception 'Topik ini sudah dikunci guru.' using errcode = '22023';
    end if;
    new.title := btrim(new.title);
    new.body := btrim(new.body);
    new.edited_at := now();
  end if;
  if new.is_hidden is distinct from old.is_hidden then
    new.hidden_by := case when new.is_hidden then auth.uid() end;
  end if;
  return new;
end;
$$;
drop trigger if exists discussion_topics_before_write on public.discussion_topics;
create trigger discussion_topics_before_write before insert or update on public.discussion_topics
  for each row execute function public.discussion_topics_before_write();

create or replace function public.discussion_replies_before_write()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_topic public.discussion_topics;
  v_manager boolean;
begin
  select * into v_topic from public.discussion_topics where id = coalesce(new.topic_id, old.topic_id);
  v_manager := public.can_manage_ta(v_topic.teaching_assignment_id);
  if tg_op = 'INSERT' then
    perform public.forum_rate_limit();
    if v_topic.is_locked and not v_manager then
      raise exception 'Topik ini sudah dikunci guru. Balasan baru tidak dapat ditambahkan.' using errcode = '22023';
    end if;
    if v_topic.is_hidden and not v_manager then
      raise exception 'Topik tidak ditemukan.' using errcode = 'P0002';
    end if;
    if new.parent_id is not null then
      -- Balasan bertingkat satu level: balasan atas balasan menempel ke balasan utamanya.
      select coalesce(r.parent_id, r.id) into new.parent_id
      from public.discussion_replies r where r.id = new.parent_id and r.topic_id = new.topic_id;
      if new.parent_id is null then
        raise exception 'Balasan yang ditanggapi tidak ditemukan.' using errcode = 'P0002';
      end if;
    end if;
    new.author_id := auth.uid();
    new.body := btrim(new.body);
    new.edited_at := null;
    new.is_hidden := false;
    new.hidden_by := null;
    return new;
  end if;

  if new.topic_id <> old.topic_id or new.author_id is distinct from old.author_id or new.parent_id is distinct from old.parent_id then
    raise exception 'Balasan tidak dapat dipindahkan.' using errcode = '23514';
  end if;
  if new.is_hidden is distinct from old.is_hidden then
    if not v_manager then
      raise exception 'Hanya guru pengampu yang dapat memoderasi diskusi.' using errcode = '42501';
    end if;
    new.hidden_by := case when new.is_hidden then auth.uid() end;
  end if;
  if new.body is distinct from old.body then
    if old.author_id is distinct from auth.uid() then
      raise exception 'Hanya penulis yang dapat mengubah balasan.' using errcode = '42501';
    end if;
    if v_topic.is_locked and not v_manager then
      raise exception 'Topik ini sudah dikunci guru.' using errcode = '22023';
    end if;
    new.body := btrim(new.body);
    new.edited_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists discussion_replies_before_write on public.discussion_replies;
create trigger discussion_replies_before_write before insert or update on public.discussion_replies
  for each row execute function public.discussion_replies_before_write();

-- Jumlah balasan, aktivitas terakhir, notifikasi.
create or replace function public.discussion_replies_after_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_topic public.discussion_topics;
  v_users uuid[];
begin
  update public.discussion_topics t set
    reply_count = (select count(*) from public.discussion_replies r where r.topic_id = t.id and not r.is_hidden),
    last_activity_at = case when tg_op = 'INSERT' then now() else t.last_activity_at end
  where t.id = coalesce(new.topic_id, old.topic_id)
  returning * into v_topic;

  if tg_op = 'INSERT' then
    v_users := array[v_topic.author_id];
    if new.parent_id is not null then
      v_users := v_users || (select author_id from public.discussion_replies where id = new.parent_id);
    end if;
    perform public.notify_users(v_users, 'forum', 'Balasan baru di diskusi: ' || v_topic.title,
      (select full_name from public.profiles where id = new.author_id) || ': ' || left(new.body, 120),
      '/diskusi/' || v_topic.id, new.id);
  end if;
  return null;
end;
$$;
-- Trigger ini mengubah discussion_topics; jalankan sebagai definer agar tidak terhalang
-- penjaga moderasi (perubahan reply_count bukan perubahan moderasi).
drop trigger if exists discussion_replies_after_write on public.discussion_replies;
create trigger discussion_replies_after_write after insert or delete or update of is_hidden on public.discussion_replies
  for each row execute function public.discussion_replies_after_write();

create or replace function public.notify_on_topic()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_teacher uuid;
begin
  if public.can_manage_ta(new.teaching_assignment_id) then
    -- Topik dari guru → seluruh siswa kelas.
    perform public.notify_users(public.ta_student_users(new.teaching_assignment_id), 'forum',
      'Diskusi baru: ' || new.title, public.ta_label(new.teaching_assignment_id), '/diskusi/' || new.id, new.id);
  else
    select t.profile_id into v_teacher
    from public.teaching_assignments ta join public.teachers t on t.id = ta.teacher_id
    where ta.id = new.teaching_assignment_id;
    perform public.notify_users(array[v_teacher], 'forum', 'Topik diskusi baru: ' || new.title,
      (select full_name from public.profiles where id = new.author_id) || ' · ' || public.ta_label(new.teaching_assignment_id),
      '/diskusi/' || new.id, new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists discussion_topics_notify on public.discussion_topics;
create trigger discussion_topics_notify after insert on public.discussion_topics
  for each row execute function public.notify_on_topic();

create or replace function public.audit_forum_moderation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_topic_alive boolean := true;
begin
  if tg_op = 'DELETE' then
    -- Balasan yang ikut terhapus bersama topiknya tidak dicatat satu per satu.
    if tg_table_name = 'discussion_replies' then
      v_topic_alive := exists (select 1 from public.discussion_topics t where t.id = (to_jsonb(old) ->> 'topic_id')::uuid);
    end if;
    if old.author_id is distinct from auth.uid() and v_topic_alive then
      insert into public.audit_logs (actor_id, action, entity, entity_id, details)
      values (auth.uid(), tg_table_name || '.delete', tg_table_name, old.id::text,
              jsonb_build_object('author_id', old.author_id, 'body', left(old.body, 200)));
    end if;
    delete from public.notifications where type = 'forum' and ref_id = old.id;
    return old;
  end if;
  if new.is_hidden is distinct from old.is_hidden then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), tg_table_name || case when new.is_hidden then '.hide' else '.unhide' end, tg_table_name, new.id::text,
            jsonb_build_object('author_id', new.author_id, 'body', left(new.body, 200)));
  end if;
  return new;
end;
$$;
drop trigger if exists discussion_topics_audit on public.discussion_topics;
create trigger discussion_topics_audit after update of is_hidden or delete on public.discussion_topics
  for each row execute function public.audit_forum_moderation();
drop trigger if exists discussion_replies_audit on public.discussion_replies;
create trigger discussion_replies_audit after update of is_hidden or delete on public.discussion_replies
  for each row execute function public.audit_forum_moderation();

alter table public.discussion_topics enable row level security;
alter table public.discussion_replies enable row level security;

drop policy if exists discussion_topics_select on public.discussion_topics;
create policy discussion_topics_select on public.discussion_topics for select to authenticated
  using (public.can_view_ta(teaching_assignment_id)
         and (not is_hidden or author_id = (select auth.uid()) or public.can_manage_ta(teaching_assignment_id)));
drop policy if exists discussion_topics_insert on public.discussion_topics;
create policy discussion_topics_insert on public.discussion_topics for insert to authenticated
  with check (public.can_view_ta(teaching_assignment_id));
drop policy if exists discussion_topics_update on public.discussion_topics;
create policy discussion_topics_update on public.discussion_topics for update to authenticated
  using (author_id = (select auth.uid()) or public.can_manage_ta(teaching_assignment_id))
  with check (public.can_view_ta(teaching_assignment_id));
drop policy if exists discussion_topics_delete on public.discussion_topics;
create policy discussion_topics_delete on public.discussion_topics for delete to authenticated
  using (public.can_manage_ta(teaching_assignment_id) or (author_id = (select auth.uid()) and reply_count = 0 and not is_locked));

drop policy if exists discussion_replies_select on public.discussion_replies;
create policy discussion_replies_select on public.discussion_replies for select to authenticated
  using (exists (select 1 from public.discussion_topics t where t.id = topic_id)   -- topik terlihat (RLS topik)
         and (not is_hidden or author_id = (select auth.uid()) or public.can_manage_ta(public.topic_ta(topic_id))));
drop policy if exists discussion_replies_insert on public.discussion_replies;
create policy discussion_replies_insert on public.discussion_replies for insert to authenticated
  with check (public.can_view_ta(public.topic_ta(topic_id)));
drop policy if exists discussion_replies_update on public.discussion_replies;
create policy discussion_replies_update on public.discussion_replies for update to authenticated
  using (author_id = (select auth.uid()) or public.can_manage_ta(public.topic_ta(topic_id)))
  with check (public.can_view_ta(public.topic_ta(topic_id)));
drop policy if exists discussion_replies_delete on public.discussion_replies;
create policy discussion_replies_delete on public.discussion_replies for delete to authenticated
  using (author_id = (select auth.uid()) or public.can_manage_ta(public.topic_ta(topic_id)));

revoke all on public.discussion_topics, public.discussion_replies from anon;
grant select, insert, update, delete on public.discussion_topics, public.discussion_replies to authenticated;

-- Peran penulis untuk label di forum.
create or replace function public.forum_author_role(p_user uuid, p_ta_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.teaching_assignments ta join public.teachers t on t.id = ta.teacher_id
                 where ta.id = p_ta_id and t.profile_id = p_user) then 'teacher'
    when exists (select 1 from public.students s where s.profile_id = p_user) then 'student'
    when exists (select 1 from public.teachers t where t.profile_id = p_user) then 'staff'
    else 'admin' end
$$;

-- Daftar topik di satu ruang kelas.
create or replace function public.get_course_topics(p_ta_id uuid)
returns table (
  id uuid, title text, excerpt text, author_id uuid, author_name text, author_role text,
  is_pinned boolean, is_locked boolean, is_hidden boolean, reply_count integer,
  last_activity_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_manager boolean := public.can_manage_ta(p_ta_id);
begin
  if not public.can_view_ta(p_ta_id) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  return query
  select t.id, t.title, left(t.body, 160), t.author_id, p.full_name, public.forum_author_role(t.author_id, p_ta_id),
         t.is_pinned, t.is_locked, t.is_hidden, t.reply_count, t.last_activity_at, t.created_at
  from public.discussion_topics t
  left join public.profiles p on p.id = t.author_id
  where t.teaching_assignment_id = p_ta_id and (not t.is_hidden or v_manager or t.author_id = auth.uid())
  order by t.is_pinned desc, t.last_activity_at desc;
end;
$$;

-- Satu topik + balasan (balasan tersembunyi hanya untuk guru/penulisnya).
create or replace function public.get_topic(p_topic_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_t public.discussion_topics;
  v_manager boolean;
begin
  select * into v_t from public.discussion_topics where id = p_topic_id;
  if v_t.id is null or not public.can_view_ta(v_t.teaching_assignment_id) then
    raise exception 'Topik tidak ditemukan.' using errcode = 'P0002';
  end if;
  v_manager := public.can_manage_ta(v_t.teaching_assignment_id);
  if v_t.is_hidden and not v_manager and v_t.author_id is distinct from auth.uid() then
    raise exception 'Topik ini disembunyikan oleh guru.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', v_t.id, 'teaching_assignment_id', v_t.teaching_assignment_id, 'course_label', public.ta_label(v_t.teaching_assignment_id),
    'title', v_t.title, 'body', v_t.body, 'author_id', v_t.author_id,
    'author_name', (select full_name from public.profiles where id = v_t.author_id),
    'author_role', public.forum_author_role(v_t.author_id, v_t.teaching_assignment_id),
    'is_pinned', v_t.is_pinned, 'is_locked', v_t.is_locked, 'is_hidden', v_t.is_hidden,
    'created_at', v_t.created_at, 'edited_at', v_t.edited_at, 'reply_count', v_t.reply_count,
    'can_moderate', v_manager, 'is_mine', v_t.author_id = auth.uid(),
    'replies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'parent_id', r.parent_id, 'body', r.body, 'author_id', r.author_id,
               'author_name', p.full_name, 'author_role', public.forum_author_role(r.author_id, v_t.teaching_assignment_id),
               'is_hidden', r.is_hidden, 'created_at', r.created_at, 'edited_at', r.edited_at,
               'is_mine', r.author_id = auth.uid())
             order by r.created_at)
      from public.discussion_replies r
      left join public.profiles p on p.id = r.author_id
      where r.topic_id = v_t.id and (not r.is_hidden or v_manager or r.author_id = auth.uid())
    ), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================
-- KALENDER
-- =====================================================================
create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null default 'school',     -- school | class
  class_id     uuid references public.classes (id) on delete cascade,
  title        text not null,
  description  text,
  category     text not null default 'activity',   -- holiday | exam | activity | other
  start_date   date not null,
  end_date     date not null,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint calendar_events_scope check ((scope = 'school' and class_id is null) or (scope = 'class' and class_id is not null)),
  constraint calendar_events_category check (category in ('holiday', 'exam', 'activity', 'other')),
  constraint calendar_events_dates check (end_date >= start_date and end_date - start_date <= 366),
  constraint calendar_events_title_len check (char_length(title) between 1 and 150)
);
create index if not exists calendar_events_dates_idx on public.calendar_events (start_date, end_date);

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select to authenticated
  using (scope = 'school' or public.is_admin() or public.student_in_class(class_id)
         or public.guards_class(class_id) or public.teaches_class(class_id));
drop policy if exists calendar_events_write on public.calendar_events;
create policy calendar_events_write on public.calendar_events for all to authenticated
  using (public.is_admin() or (scope = 'class' and public.guards_class(class_id)))
  with check (public.is_admin() or (scope = 'class' and public.guards_class(class_id)));
revoke all on public.calendar_events from anon;
grant select, insert, update, delete on public.calendar_events to authenticated;

-- Kalender pribadi: agenda sekolah/kelas + tenggat tugas + jadwal kuis.
create or replace function public.get_my_calendar(p_from date, p_to date)
returns table (
  kind text, id uuid, title text, subtitle text, category text, color text,
  start_at timestamptz, end_at timestamptz, all_day boolean, link text, done boolean, can_edit boolean,
  description text, start_date date, end_date date, scope text, class_id uuid
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_teacher uuid := public.current_teacher_id();
  v_from timestamptz := (p_from::timestamp at time zone 'Asia/Jakarta');
  v_to timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Jakarta');
begin
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Rentang tanggal tidak valid (maksimal 2 bulan).' using errcode = '22023';
  end if;

  -- Agenda sekolah & kelas
  return query
  select 'event', e.id, e.title,
         case e.scope when 'school' then 'Agenda sekolah' else 'Kelas ' || c.name end,
         e.category, null::text,
         (e.start_date::timestamp at time zone 'Asia/Jakarta'), ((e.end_date + 1)::timestamp at time zone 'Asia/Jakarta'),
         true, null::text, false,
         public.is_admin() or (e.scope = 'class' and public.guards_class(e.class_id)),
         e.description, e.start_date, e.end_date, e.scope, e.class_id
  from public.calendar_events e
  left join public.classes c on c.id = e.class_id
  where e.start_date <= p_to and e.end_date >= p_from
    and (e.scope = 'school' or public.is_admin() or public.student_in_class(e.class_id)
         or public.guards_class(e.class_id) or public.teaches_class(e.class_id));

  -- Tugas (tenggat) & kuis di ruang kelas yang relevan (semester aktif)
  return query
  with my_ta as (
    select ta.id, ta.class_id, sub.name as subject_name, sub.color, c.name as class_name
    from public.teaching_assignments ta
    join public.subjects sub on sub.id = ta.subject_id
    join public.classes c on c.id = ta.class_id
    where ta.semester_id = public.active_semester_id()
      and ((v_student is not null and ta.class_id in (select e.class_id from public.class_enrollments e where e.student_id = v_student))
           or (v_teacher is not null and ta.teacher_id = v_teacher))
  )
  select 'assignment', a.id, a.title, m.subject_name || case when v_student is null then ' · ' || m.class_name else '' end,
         'assignment', m.color, a.due_at, a.due_at, false,
         case when v_student is not null then '/siswa/tugas/' || a.id else '/guru/kelas/' || m.id || '/tugas/' || a.id end,
         v_student is not null and exists (select 1 from public.assignment_submissions s
                                          where s.assignment_id = a.id and s.student_id = v_student and s.status = 'submitted'),
         false, null::text, null::date, null::date, null::text, null::uuid
  from public.assignments a join my_ta m on m.id = a.teaching_assignment_id
  where a.due_at >= v_from and a.due_at < v_to
    and (a.status = 'published' or (v_student is null))
  union all
  select 'quiz', q.id, q.title, m.subject_name || case when v_student is null then ' · ' || m.class_name else '' end,
         q.kind, m.color, q.open_at, q.close_at, false,
         case when v_student is not null then '/siswa/kuis/' || q.id else '/guru/kelas/' || m.id || '/kuis/' || q.id end,
         v_student is not null and exists (select 1 from public.quiz_attempts at where at.quiz_id = q.id and at.student_id = v_student and at.status = 'submitted'),
         false, null::text, null::date, null::date, null::text, null::uuid
  from public.quizzes q join my_ta m on m.id = q.teaching_assignment_id
  where q.open_at < v_to and q.close_at >= v_from
    and (q.status = 'published' or (v_student is null));
end;
$$;

-- =====================================================================
-- Hak eksekusi
-- =====================================================================
do $$
declare f text;
begin
  foreach f in array array[
    'get_my_notifications(integer, bigint)', 'mark_notifications_read(bigint[])',
    'get_announcements(uuid, boolean, integer, uuid)', 'get_announcement_targets()',
    'can_manage_announcement(text, uuid, uuid)', 'can_read_announcement(text, uuid, uuid)',
    'topic_ta(uuid)', 'get_course_topics(uuid)', 'get_topic(uuid)', 'get_my_calendar(date, date)',
    'ta_label(uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end$$;

-- Fungsi internal (trigger / fan-out): tidak dapat dipanggil langsung oleh pengguna.
do $$
declare f text;
begin
  foreach f in array array[
    'notify_users(uuid[], text, text, text, text, uuid, timestamptz)', 'class_student_users(uuid)', 'ta_student_users(uuid)',
    'notification_enabled(text)', 'generate_my_reminders()', 'notify_on_lesson()', 'notify_on_assignment()', 'notify_on_grade()',
    'notify_on_quiz()', 'notify_on_quiz_graded()', 'notify_on_announcement()', 'announcements_after_update()',
    'audit_announcement_delete()', 'discussion_replies_after_write()', 'notify_on_topic()', 'audit_forum_moderation()',
    'forum_author_role(uuid, uuid)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end$$;
-- Dipanggil dari trigger yang berjalan sebagai pengguna: tetap boleh dieksekusi authenticated.
revoke execute on function public.forum_rate_limit() from public, anon;
grant execute on function public.forum_rate_limit() to authenticated;
revoke execute on function public.announcements_before_write() from public, anon;
revoke execute on function public.discussion_topics_before_write() from public, anon;
revoke execute on function public.discussion_replies_before_write() from public, anon;
