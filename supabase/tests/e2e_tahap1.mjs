// Uji ujung-ke-ujung Tahap 1 terhadap proyek Supabase (lokal atau staging — JANGAN produksi).
// Jalankan: SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap1.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const ANON = process.env.ANON_KEY
const DOMAIN = process.env.LOGIN_EMAIL_DOMAIN ?? 'lms.smpn1baradatu.sch.id'
const email = (u) => (u.includes('@') ? u : `${u}@${DOMAIN}`)
const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const suffix = Date.now().toString().slice(-6)

let failed = 0
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'GAGAL'} ${msg}`)
  if (!cond) failed++
}
async function invoke(c, body) {
  const { data, error } = await c.functions.invoke('admin-users', { body })
  if (!error) return { data }
  let msg = error.message
  try { msg = (await error.context.json()).error } catch { /* */ }
  return { error: msg, status: error.context?.status }
}

// --- Admin login
const admin = client()
const { error: aErr } = await admin.auth.signInWithPassword({ email: email(process.env.ADMIN_LOGIN), password: process.env.ADMIN_PASSWORD })
check(!aErr, 'admin login dengan username')
const { data: actx } = await admin.rpc('get_my_context')
check(actx?.roles?.includes('admin'), 'get_my_context admin berisi role admin')

// --- Buat akun
const tUser = `19800101${suffix}`, sUser = `00${suffix}11`
const t = await invoke(admin, { action: 'create', username: tUser, full_name: 'Budi Santoso', roles: ['teacher'] })
check(t.data?.password?.length === 10, 'admin membuat akun guru (password acak 10 karakter)')
const s = await invoke(admin, { action: 'create', username: sUser, full_name: 'Siti Aminah', roles: ['student'], password: 'Awal12345' })
check(s.data?.user_id, 'admin membuat akun siswa dengan password awal')
const dup = await invoke(admin, { action: 'create', username: sUser, full_name: 'Duplikat', roles: ['student'] })
check(dup.status === 409, `username duplikat ditolak (${dup.error})`)
const bad = await invoke(admin, { action: 'create', username: 'A B', full_name: 'X', roles: ['student'] })
check(bad.status === 400, 'username tidak valid ditolak')

// --- Daftar akun, filter role, pencarian dengan spasi
const { data: list, count } = await admin.from('profiles').select('id, full_name, user_roles(role), role_filter:user_roles!inner(role)', { count: 'exact' }).eq('role_filter.role', 'student')
check(list?.some((r) => r.id === s.data.user_id) && !list.some((r) => r.id === t.data.user_id), `filter role siswa (${count} akun)`)
const { data: found } = await admin.from('profiles').select('id').or('full_name.ilike."*siti amin*",username.ilike."*siti amin*"')
check(found?.some((r) => r.id === s.data.user_id), 'pencarian nama dengan spasi')

// --- Login siswa pertama kali
const student = client()
const { error: sErr } = await student.auth.signInWithPassword({ email: email(sUser), password: 'Awal12345' })
check(!sErr, 'siswa login dengan NISN')
let { data: sctx } = await student.rpc('get_my_context')
check(sctx?.must_change_password === true, 'siswa wajib ganti password saat login pertama')
await student.auth.updateUser({ password: 'Pribadi123' })
await student.rpc('mark_password_changed')
;({ data: sctx } = await student.rpc('get_my_context'))
check(sctx?.must_change_password === false, 'setelah ganti password, flag dibersihkan')

// --- Batas akses siswa
const { data: sp } = await student.from('profiles').select('id')
check(sp?.length === 1, 'siswa hanya bisa membaca profilnya sendiri')
const { data: sa } = await student.from('audit_logs').select('id')
check((sa ?? []).length === 0, 'siswa tidak bisa membaca audit log')
await student.from('school_settings').update({ school_name: 'DIRETAS' }).eq('id', true)
const { data: ss } = await admin.from('school_settings').select('school_name').single()
check(ss.school_name !== 'DIRETAS', 'siswa tidak bisa mengubah pengaturan sekolah')
const { error: roleErr } = await student.from('user_roles').insert({ user_id: s.data.user_id, role: 'admin' })
check(Boolean(roleErr), 'siswa tidak bisa memberi dirinya role admin')
const { error: actErr } = await student.from('profiles').update({ is_active: true }).eq('id', s.data.user_id)
check(Boolean(actErr), 'siswa tidak bisa mengubah kolom is_active')
const sInv = await invoke(student, { action: 'create', username: 'hacker', full_name: 'Hacker', roles: ['admin'] })
check(sInv.status === 403, 'siswa ditolak memanggil Edge Function admin')
const { error: statErr } = await student.rpc('admin_account_stats')
check(Boolean(statErr), 'siswa ditolak membaca statistik admin')
const { error: revErr } = await student.rpc('revoke_user_sessions', { p_user_id: t.data.user_id })
check(Boolean(revErr), 'siswa tidak bisa mencabut sesi pengguna lain')
const { error: phoneErr } = await student.from('profiles').update({ phone: '081234567890' }).eq('id', s.data.user_id)
check(!phoneErr, 'siswa bisa mengubah nomor HP sendiri')

// --- Reset password oleh admin (sesi lama dicabut)
const oldRefresh = (await student.auth.getSession()).data.session.refresh_token
const r = await invoke(admin, { action: 'reset_password', user_id: s.data.user_id })
check(Boolean(r.data?.password), 'admin mereset password siswa')
const { error: refreshErr } = await client().auth.refreshSession({ refresh_token: oldRefresh })
check(Boolean(refreshErr), 'sesi lama siswa dicabut setelah reset')
const { error: oldPwErr } = await client().auth.signInWithPassword({ email: email(sUser), password: 'Pribadi123' })
check(Boolean(oldPwErr), 'password lama tidak berlaku lagi')
const s2 = client()
const { error: newPwErr } = await s2.auth.signInWithPassword({ email: email(sUser), password: r.data.password })
check(!newPwErr, 'password sementara baru berlaku')
check((await s2.rpc('get_my_context')).data?.must_change_password === true, 'setelah reset, wajib ganti password lagi')

// --- Nonaktifkan & aktifkan
const off = await invoke(admin, { action: 'set_status', user_id: s.data.user_id, is_active: false })
check(off.data?.is_active === false, 'admin menonaktifkan akun siswa')
const { error: bannedErr } = await client().auth.signInWithPassword({ email: email(sUser), password: r.data.password })
check(/banned/i.test(bannedErr?.message ?? ''), `akun nonaktif tidak bisa login (${bannedErr?.message})`)
const on = await invoke(admin, { action: 'set_status', user_id: s.data.user_id, is_active: true })
const { error: backErr } = await client().auth.signInWithPassword({ email: email(sUser), password: r.data.password })
check(on.data?.is_active === true && !backErr, 'akun diaktifkan kembali bisa login')
const self = await invoke(admin, { action: 'set_status', user_id: actx.id, is_active: false })
check(self.status === 400, 'admin tidak bisa menonaktifkan akun sendiri')

// --- Role & profil
const roles = await invoke(admin, { action: 'set_roles', user_id: t.data.user_id, roles: ['teacher', 'admin'] })
const { data: tr } = await admin.from('user_roles').select('role').eq('user_id', t.data.user_id)
check(roles.data && tr.length === 2, 'admin menambah role admin ke guru')
await invoke(admin, { action: 'set_roles', user_id: t.data.user_id, roles: ['teacher'] })
const { data: tr2 } = await admin.from('user_roles').select('role').eq('user_id', t.data.user_id)
check(tr2.length === 1 && tr2[0].role === 'teacher', 'admin mencabut role admin dari guru')
const selfRole = await invoke(admin, { action: 'set_roles', user_id: actx.id, roles: ['teacher'] })
check(selfRole.status === 400, 'admin tidak bisa mencabut role admin dirinya sendiri')
const { error: upErr } = await admin.rpc('admin_update_profile', { p_user_id: s.data.user_id, p_full_name: 'Siti Aminah Putri', p_contact_email: null, p_phone: null })
check(!upErr, 'admin mengubah nama siswa')

// --- Statistik & audit
const { data: stats } = await admin.rpc('admin_account_stats')
check(stats?.students >= 1 && stats?.teachers >= 1, `statistik admin (${stats?.students} siswa, ${stats?.teachers} guru)`)
const { data: logs } = await admin.from('audit_logs').select('action').order('id', { ascending: false }).limit(30)
const actions = new Set(logs.map((l) => l.action))
check(['user.create', 'user.reset_password', 'user.deactivate', 'user.activate', 'user.set_roles', 'user.update_profile'].every((a) => actions.has(a)), 'semua tindakan admin tercatat di audit log')
const { error: delLog } = await admin.from('audit_logs').delete().gt('id', 0).select()
const { count: logCount } = await admin.from('audit_logs').select('id', { count: 'exact', head: true })
check(logCount > 0 && (delLog || true), 'audit log tidak bisa dihapus, bahkan oleh admin')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
