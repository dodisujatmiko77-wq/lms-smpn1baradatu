-- Audit keamanan otomatis (Tahap 8). Gagal bila ada tabel/fungsi baru yang lupa diamankan.
\set ON_ERROR_STOP 1
begin;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'OK: %', msg; end $$;

select pg_temp.check(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
), 'semua tabel public memakai RLS: ' || coalesce((select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'tidak ada pengecualian'));

select pg_temp.check((
  select coalesce(array_agg(c.relname order by c.relname), '{}') from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
) = array['activity_events']::name[], 'tabel tanpa policy hanya activity_events (diakses lewat fungsi laporan saja)');

select pg_temp.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
), 'semua fungsi SECURITY DEFINER mengunci search_path');

select pg_temp.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
), 'pengguna tanpa login (anon) tidak bisa memanggil fungsi apa pun: ' || coalesce((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), '-'));

select pg_temp.check((
  select coalesce(array_agg(distinct table_name::text), '{}') from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
) = array['school_settings'], 'anon hanya boleh membaca school_settings (identitas sekolah di halaman login)');

select pg_temp.check(not exists (
  select 1 from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'
), 'anon tidak punya hak tulis pada tabel mana pun');

select pg_temp.check(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce((select option_value = 'true' from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), false)
), 'semua view memakai security_invoker (RLS tabel asal tetap berlaku)');

select pg_temp.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prorettype = 'trigger'::regtype and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute')
), 'fungsi trigger SECURITY DEFINER tidak bisa dipanggil langsung oleh pengguna');

select pg_temp.check(not has_table_privilege('authenticated', 'public.audit_logs', 'insert, update, delete'), 'audit log tidak bisa ditulis/diubah/dihapus pengguna');
select pg_temp.check(not has_table_privilege('authenticated', 'public.quiz_attempts', 'insert, update, delete')
                 and not has_table_privilege('authenticated', 'public.quiz_answers', 'insert, update, delete'), 'percobaan & jawaban kuis hanya ditulis lewat fungsi server');
select pg_temp.check(not has_table_privilege('authenticated', 'public.notifications', 'insert, update, delete'), 'notifikasi hanya dibuat server');
select pg_temp.check(not has_table_privilege('authenticated', 'public.student_achievements', 'insert, update, delete'), 'badge hanya diberikan server');
select pg_temp.check(not has_table_privilege('authenticated', 'public.activity_events', 'select'), 'log aktivitas mentah tidak bisa dibaca');

-- Kunci asing yang dipakai untuk filter/RLS/penghapusan berantai harus berindeks.
select pg_temp.check(not exists (
  select 1 from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
    and a.attname not in ('created_by', 'graded_by', 'hidden_by', 'achievement_code')
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
), 'kunci asing penting berindeks: ' || coalesce((
  select string_agg(c.conrelid::regclass || '.' || a.attname, ', ')
  from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
    and a.attname not in ('created_by', 'graded_by', 'hidden_by', 'achievement_code')
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])), '-'));
rollback;
