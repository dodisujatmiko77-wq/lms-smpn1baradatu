// Uji ujung-ke-ujung Tahap 2 (data master) — JANGAN dijalankan ke proyek produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap2.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const ANON = process.env.ANON_KEY
const DOMAIN = process.env.LOGIN_EMAIL_DOMAIN ?? 'lms.smpn1baradatu.sch.id'
const email = (u) => (u.includes('@') ? u : `${u}@${DOMAIN}`)
const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

let failed = 0
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'GAGAL'} ${msg}`)
  if (!cond) failed++
}
const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}
async function invoke(c, body) {
  const { data, error } = await c.functions.invoke('admin-users', { body })
  if (!error) return { data }
  let msg = error.message
  try { msg = (await error.context.json()).error } catch { /* */ }
  return { error: msg, status: error.context?.status }
}
async function login(username, password) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email: email(username), password })
  if (error) throw new Error(`login ${username}: ${error.message}`)
  return c
}

const admin = await login(process.env.ADMIN_LOGIN, process.env.ADMIN_PASSWORD)

// --- Tahun pelajaran & semester
const y1 = 2100 + Math.floor(Math.random() * 800)
const yearId = must(await admin.rpc('admin_create_academic_year', { p_name: `${y1}/${y1 + 1}`, p_start_date: `${y1}-07-13`, p_end_date: `${y1 + 1}-06-30` }))
const sems = must(await admin.from('semesters').select('id, number').eq('academic_year_id', yearId).order('number'))
check(sems.length === 2, 'tahun pelajaran dibuat dengan 2 semester')
must(await admin.rpc('set_active_semester', { p_semester_id: sems[0].id }))
const { data: ctx } = await admin.rpc('get_my_context')
check(ctx.active_semester?.id === sems[0].id, 'semester Ganjil menjadi semester aktif')
const semId = sems[0].id

// --- Mapel & kelas
must(await admin.from('subjects').upsert([{ code: 'MTK', name: 'Matematika' }, { code: 'BIN', name: 'Bahasa Indonesia' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = Object.fromEntries(must(await admin.from('subjects').select('id, code').in('code', ['MTK', 'BIN'])).map((s) => [s.code, s.id]))
const classes = must(await admin.from('classes').insert([{ academic_year_id: yearId, grade: 7, name: 'VII-A' }, { academic_year_id: yearId, grade: 7, name: 'VII-B' }]).select('id, name'))
const cls = Object.fromEntries(classes.map((c) => [c.name, c.id]))
const { error: dupClass } = await admin.from('classes').insert({ academic_year_id: yearId, grade: 7, name: 'VII-A' })
check(/classes_unique_name/.test(dupClass?.message ?? ''), 'nama kelas ganda dalam satu TP ditolak')

// --- Impor massal siswa
const nisn = [rnd(10), rnd(10), rnd(10)]
const stuRow = (n, name, gender, classId) => ({ username: n, full_name: name, roles: ['student'], student: { nisn: n, gender, class_id: classId, birth_date: '2013-05-21' } })
const bulk = await invoke(admin, {
  action: 'bulk_create',
  rows: [
    stuRow(nisn[0], 'Ani Lestari', 'P', cls['VII-A']),
    stuRow(nisn[1], 'Budi Pratama', 'L', cls['VII-A']),
    stuRow(nisn[2], 'Cici Amelia', 'P', cls['VII-B']),
    stuRow('123456789', 'NISN Salah', 'P', null),
  ],
})
const res = bulk.data?.results ?? []
check(res.filter((r) => r.ok).length === 3, 'impor massal: 3 siswa berhasil dibuat')
check(res[3] && !res[3].ok && /NISN/.test(res[3].error), `impor massal: baris NISN salah ditolak (${res[3]?.error})`)
const pw = Object.fromEntries(res.filter((r) => r.ok).map((r) => [r.username, r.password]))

// NISN sama dengan username berbeda → gagal & akun Auth dikompensasi
const dupUser = `dup${rnd(6)}`
const dup = await invoke(admin, { action: 'create', username: dupUser, full_name: 'Duplikat', roles: ['student'], student: { nisn: nisn[0], gender: 'L' } })
check(dup.status === 409 && /NISN sudah terdaftar/.test(dup.error), `NISN ganda ditolak dengan pesan jelas (${dup.error})`)
const { data: orphan } = await admin.from('profiles').select('id').eq('username', dupUser)
check(orphan.length === 0, 'akun yang gagal dibuat tidak menyisakan profil (kompensasi)')

const placed = must(await admin.from('v_students').select('nisn, class_name').in('nisn', nisn))
check(placed.filter((p) => p.class_name === 'VII-A').length === 2 && placed.some((p) => p.class_name === 'VII-B'), 'siswa impor langsung ditempatkan di kelasnya')

// --- Impor guru
const nip1 = rnd(18)
const tUser2 = `guru${rnd(5)}`
const tb = await invoke(admin, {
  action: 'bulk_create',
  rows: [
    { username: nip1, full_name: 'Drs. Hendra, M.Pd.', roles: ['teacher'], teacher: { nip: nip1, gender: 'L', employment_status: 'PNS' } },
    { username: tUser2, full_name: 'Sari Dewi, S.Pd.', roles: ['teacher'], phone: '081234567890', teacher: { gender: 'P', employment_status: 'Honorer' } },
    { username: rnd(18), full_name: 'NIP Salah', roles: ['teacher'], teacher: { nip: '123' } },
  ],
})
const tres = tb.data?.results ?? []
check(tres.filter((r) => r.ok).length === 2 && /NIP/.test(tres[2]?.error ?? ''), 'impor guru: 2 berhasil, NIP tidak valid ditolak')
const tpw = Object.fromEntries(tres.filter((r) => r.ok).map((r) => [r.username, r.password]))
const teachers = Object.fromEntries(must(await admin.from('v_teachers').select('id, username').in('username', [nip1, tUser2])).map((t) => [t.username, t.id]))

// --- Penugasan, wali kelas, jadwal
const tas = must(
  await admin.from('teaching_assignments').insert([
    { teacher_id: teachers[nip1], class_id: cls['VII-A'], subject_id: subj.MTK, semester_id: semId, hours_per_week: 5 },
    { teacher_id: teachers[nip1], class_id: cls['VII-B'], subject_id: subj.MTK, semester_id: semId, hours_per_week: 5 },
    { teacher_id: teachers[tUser2], class_id: cls['VII-A'], subject_id: subj.BIN, semester_id: semId, hours_per_week: 6 },
  ]).select('id, class_id, subject_id'),
)
const ta = (c, s) => tas.find((t) => t.class_id === cls[c] && t.subject_id === subj[s]).id
must(await admin.from('class_guardians').upsert({ class_id: cls['VII-A'], teacher_id: teachers[tUser2], semester_id: semId }, { onConflict: 'class_id,semester_id' }))
must(await admin.from('schedules').insert([
  { teaching_assignment_id: ta('VII-A', 'MTK'), day_of_week: 1, start_time: '07:30', end_time: '08:50' },
  { teaching_assignment_id: ta('VII-A', 'BIN'), day_of_week: 1, start_time: '08:50', end_time: '10:10' },
  { teaching_assignment_id: ta('VII-B', 'MTK'), day_of_week: 2, start_time: '07:30', end_time: '08:50' },
]))
const { error: clash } = await admin.from('schedules').insert({ teaching_assignment_id: ta('VII-B', 'MTK'), day_of_week: 1, start_time: '08:00', end_time: '09:00' })
check(/Guru sudah mengajar/.test(clash?.message ?? ''), `jadwal bentrok guru ditolak lewat API (${clash?.message})`)
const stats = must(await admin.rpc('admin_school_stats'))
check(stats.classes === 2 && stats.assignments === 3 && stats.schedules === 3, 'statistik sekolah sesuai data')

// --- Sudut pandang guru 1
const g1 = await login(nip1, tpw[nip1])
check((await g1.rpc('get_my_context')).data.must_change_password === true, 'guru hasil impor wajib ganti password')
check((await g1.rpc('get_my_teaching')).data.length === 2, 'guru melihat 2 kelas yang diajar')
check((await g1.rpc('get_my_schedule')).data.length === 2, 'jadwal mengajar guru: 2 sesi')
check((await g1.from('v_students').select('id').in('nisn', nisn)).data.length === 3, 'guru melihat data siswa di kelas yang ia ajar')
check((await g1.from('v_teachers').select('id')).data.length === 1, 'guru hanya melihat data guru dirinya')
const { error: g1write } = await g1.rpc('enroll_students', { p_class_id: cls['VII-B'], p_student_ids: [] })
check(Boolean(g1write), 'guru tidak bisa menempatkan siswa')

// --- Guru 2 (wali kelas VII-A)
const g2 = await login(tUser2, tpw[tUser2])
check((await g2.rpc('get_my_context')).data.guardian_class_ids.length === 1, 'wali kelas terdeteksi (menu Wali Kelas muncul)')
check((await g2.from('v_students').select('id').in('nisn', nisn)).data.length === 2, 'wali kelas VII-A melihat 2 siswanya, bukan siswa VII-B')

// --- Siswa
const s1 = await login(nisn[0], pw[nisn[0]])
const sctx = (await s1.rpc('get_my_context')).data
check(sctx.student_class?.name === 'VII-A', 'siswa: konteks berisi kelas VII-A')
const ssched = (await s1.rpc('get_my_schedule')).data
check(ssched.length === 2 && ssched.every((s) => s.class_name === 'VII-A'), 'siswa melihat jadwal kelasnya saja')
check(ssched.some((s) => s.teacher_name === 'Drs. Hendra, M.Pd.'), 'siswa melihat nama guru pada jadwal')
check((await s1.from('v_students').select('id')).data.length === 1, 'siswa hanya melihat data dirinya')
check((await s1.from('v_teachers').select('id')).data.length === 0, 'siswa tidak bisa membaca data guru (NIP)')
const s3 = await login(nisn[2], pw[nisn[2]])
check((await s3.rpc('get_my_schedule')).data.every((s) => s.class_name === 'VII-B'), 'siswa VII-B tidak melihat jadwal VII-A')

// --- Ubah data & pindah kelas
const sid = must(await admin.from('students').select('id').eq('nisn', nisn[1]).single()).id
must(await admin.rpc('admin_update_student', { p_student_id: sid, p_data: { full_name: 'Budi Pratama Putra', nis: `N${rnd(5)}`, status: 'active' } }))
must(await admin.rpc('enroll_students', { p_class_id: cls['VII-B'], p_student_ids: [sid] }))
const moved = must(await admin.from('v_students').select('full_name, class_name').eq('id', sid).single())
check(moved.full_name === 'Budi Pratama Putra' && moved.class_name === 'VII-B', 'admin mengubah data siswa & memindahkan kelas')

// --- Salin penugasan Ganjil → Genap
const copied = must(await admin.rpc('copy_teaching_assignments', { p_from_semester: sems[0].id, p_to_semester: sems[1].id }))
check(copied === 3, 'salin penugasan ke semester Genap (3)')

const { data: logs } = await admin.from('audit_logs').select('action').order('id', { ascending: false }).limit(60)
check(logs.some((l) => l.action === 'user.bulk_create') && logs.some((l) => l.action === 'teaching_assignments.insert'), 'impor massal & penugasan tercatat di audit log')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
