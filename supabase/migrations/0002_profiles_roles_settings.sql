-- =====================================================================
-- 0002 — Profil pengguna, role, pengaturan sekolah, audit log
-- Tahap 1 (Fondasi)
--
-- Identitas akun berasal dari Supabase Auth (auth.users).
-- Password TIDAK pernah disimpan di tabel aplikasi.
-- Akun dibuat oleh admin melalui Edge Function `admin-users`
-- (service_role hanya ada di server).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  username              text not null,
  full_name             text not null,
  email                 text not null,               -- email login (bisa email internal)
  contact_email         text,                        -- email asli untuk kontak (opsional)
  phone                 text,
  avatar_path           text,
  is_active             boolean not null default true,
  must_change_password  boolean not null default false,
  last_login_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,40}$'),
  constraint profiles_full_name_len check (char_length(full_name) between 2 and 120)
);

create unique index if not exists profiles_username_key on public.profiles (username);
create index if not exists profiles_is_active_idx on public.profiles (is_active);
create index if not exists profiles_full_name_idx on public.profiles (lower(full_name));

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role)
);

create index if not exists user_roles_role_idx on public.user_roles (role);

-- Pengaturan sekolah terpusat (selalu tepat satu baris, id = true).
create table if not exists public.school_settings (
  id                         boolean primary key default true,
  school_name                text not null default 'UPT SMP Negeri 1 Baradatu',
  short_name                 text not null default 'SMPN 1 Baradatu',
  app_name                   text not null default 'LMS Digital',
  tagline                    text default 'Belajar di mana saja, kapan saja',
  npsn                       text,
  address                    text default 'Baradatu, Kabupaten Way Kanan, Lampung',
  phone                      text,
  email                      text,
  website                    text,
  logo_path                  text,
  max_upload_mb              integer not null default 5,
  max_image_upload_mb        integer not null default 2,
  allowed_file_types         text[] not null default array['pdf','doc','docx','ppt','pptx','xls','xlsx','jpg','jpeg','png','webp'],
  notification_prefs         jsonb not null default '{"new_material":true,"new_assignment":true,"deadline_reminder":true,"grade_published":true,"announcement":true}'::jsonb,
  material_requires_publish  boolean not null default true,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint school_settings_singleton check (id),
  constraint school_settings_upload_limits check (max_upload_mb between 1 and 50 and max_image_upload_mb between 1 and 20)
);

insert into public.school_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,          -- mis. 'user.create', 'user.reset_password', 'settings.update'
  entity      text not null,          -- nama tabel / domain
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- updated_at triggers
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists school_settings_set_updated_at on public.school_settings;
create trigger school_settings_set_updated_at before update on public.school_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Fungsi helper hak akses (dipakai oleh RLS)
-- SECURITY DEFINER agar tidak terkena RLS rekursif; search_path dikosongkan.
-- Di policy, panggil sebagai (select public.fn()) agar dievaluasi sekali.
-- ---------------------------------------------------------------------

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid()
      and r.role = p_role
      and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

-- ---------------------------------------------------------------------
-- Audit otomatis untuk tabel sensitif
-- ---------------------------------------------------------------------

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_id,
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists school_settings_audit on public.school_settings;
create trigger school_settings_audit after update on public.school_settings
  for each row execute function public.audit_row_change();

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Pembuatan profil otomatis saat akun Auth dibuat.
-- Role dibaca dari raw_app_meta_data bila sudah ada saat INSERT (hanya bisa
-- diisi server/service_role), sehingga pendaftaran publik tidak mendapat role.
-- Catatan: GoTrue Admin API mengisi app_metadata setelah INSERT, karena itu
-- Edge Function admin-users menulis role secara eksplisit.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_full_name text;
begin
  v_username := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  ));
  v_full_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_username);

  insert into public.profiles (id, username, full_name, email, contact_email, must_change_password)
  values (
    new.id,
    v_username,
    v_full_name,
    new.email,
    nullif(new.raw_user_meta_data ->> 'contact_email', ''),
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  );

  if jsonb_typeof(new.raw_app_meta_data -> 'roles') = 'array' then
    insert into public.user_roles (user_id, role)
    select new.id, r::public.app_role
    from jsonb_array_elements_text(new.raw_app_meta_data -> 'roles') as r
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- RPC untuk frontend
-- ---------------------------------------------------------------------

-- Konteks pengguna yang sedang login: profil + role (satu request).
create or replace function public.get_my_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
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
    'roles', coalesce(
      (select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id),
      '[]'::jsonb
    ),
    -- Diisi pada Tahap 2 setelah tabel class_guardians tersedia.
    'guardian_class_ids', '[]'::jsonb
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Dicatat setiap kali login berhasil.
create or replace function public.record_login()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

-- Dipanggil setelah pengguna berhasil mengganti password-nya sendiri.
create or replace function public.mark_password_changed()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

-- Admin memperbarui data profil dasar (bukan username/email login).
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_contact_email text default null,
  p_phone text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  if not public.is_admin() then
    raise exception 'Hanya administrator yang dapat mengubah profil pengguna' using errcode = '42501';
  end if;

  select to_jsonb(p) into v_old from public.profiles p where p.id = p_user_id;
  if v_old is null then
    raise exception 'Pengguna tidak ditemukan' using errcode = 'P0002';
  end if;

  update public.profiles
     set full_name = trim(p_full_name),
         contact_email = nullif(trim(p_contact_email), ''),
         phone = nullif(trim(p_phone), '')
   where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'user.update_profile', 'profiles', p_user_id::text,
          jsonb_build_object('old', v_old - 'email',
                             'new', jsonb_build_object('full_name', p_full_name, 'contact_email', p_contact_email, 'phone', p_phone)));
end;
$$;

-- Mencabut seluruh sesi login pengguna (dipakai Edge Function saat reset
-- password / nonaktifkan akun). Hanya service_role yang boleh memanggil.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_user_id;
$$;

-- Statistik akun untuk dashboard admin.
create or replace function public.admin_account_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from public.profiles),
    'active', (select count(*) from public.profiles where is_active),
    'inactive', (select count(*) from public.profiles where not is_active),
    'admins', (select count(*) from public.user_roles where role = 'admin'),
    'teachers', (select count(*) from public.user_roles where role = 'teacher'),
    'students', (select count(*) from public.user_roles where role = 'student'),
    'logged_in_7d', (select count(*) from public.profiles where last_login_at > now() - interval '7 days'),
    'by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'created', c, 'logins', l) order by m), '[]'::jsonb)
      from (
        select gs as m,
               (select count(*) from public.profiles p where date_trunc('month', p.created_at) = gs) as c,
               (select count(*) from public.profiles p where date_trunc('month', p.last_login_at) = gs) as l
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') gs
      ) t
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.user_roles      enable row level security;
alter table public.school_settings enable row level security;
alter table public.audit_logs      enable row level security;

-- profiles: pengguna membaca profilnya sendiri; admin membaca semua.
-- (Akses guru/wali kelas ke profil siswa ditambahkan pada Tahap 2.)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Pengguna hanya boleh mengubah kolom tertentu milik sendiri (lihat GRANT di bawah).
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_roles: baca milik sendiri; admin baca semua. Tulis hanya lewat server.
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- school_settings: semua orang (termasuk halaman login) boleh membaca; admin mengubah.
drop policy if exists school_settings_select on public.school_settings;
create policy school_settings_select on public.school_settings
  for select to anon, authenticated
  using (true);

drop policy if exists school_settings_update on public.school_settings;
create policy school_settings_update on public.school_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- audit_logs: hanya admin yang membaca; tidak ada yang bisa mengubah/menghapus.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Hak tabel & fungsi (lapis kedua selain RLS)
-- ---------------------------------------------------------------------

revoke all on public.profiles, public.user_roles, public.school_settings, public.audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (phone, avatar_path) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.school_settings to anon, authenticated;
grant update (school_name, short_name, app_name, tagline, npsn, address, phone, email, website, logo_path,
              max_upload_mb, max_image_upload_mb, allowed_file_types, notification_prefs, material_requires_publish)
  on public.school_settings to authenticated;
grant select on public.audit_logs to authenticated;

revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.get_my_context() from public, anon;
revoke execute on function public.record_login() from public, anon;
revoke execute on function public.mark_password_changed() from public, anon;
revoke execute on function public.admin_update_profile(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_account_stats() from public, anon;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_my_context() to authenticated;
grant execute on function public.record_login() to authenticated;
grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;
grant execute on function public.admin_account_stats() to authenticated;
