// Uji ujung-ke-ujung Tahap 8 (pengerasan akses anonim & pembersihan berkas semester lalu) — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap8.mjs
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.ANON_KEY
const DOMAIN = process.env.LOGIN_EMAIL_DOMAIN ?? 'lms.smpn1baradatu.sch.id'
const BUCKET = 'assignment-files'
const email = (u) => (u.includes('@') ? u : `${u}@${DOMAIN}`)
const client = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
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
async function login(u, p) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email: email(u), password: p })
  if (error) throw new Error(`login ${u}: ${error.message}`)
  return c
}

// ===== Pengguna tanpa login (anon) =====
const anon = client()
check(Boolean((await anon.rpc('get_my_context')).error), 'anon tidak bisa memanggil fungsi aplikasi')
check(Boolean((await anon.rpc('try_uuid', { p: 'x' })).error), 'anon tidak bisa memanggil fungsi utilitas')
check(must(await anon.from('school_settings').select('school_name')).length === 1, 'anon tetap bisa membaca identitas sekolah (halaman login)')
for (const t of ['profiles', 'students', 'assignments', 'quiz_questions', 'notifications', 'announcements', 'activity_events']) {
  const { data, error } = await anon.from(t).select('*').limit(1)
  check(Boolean(error) || data.length === 0, `anon tidak bisa membaca tabel ${t}`)
}
check(Boolean((await anon.from('school_settings').update({ tagline: 'x' }).eq('id', true)).error), 'anon tidak bisa mengubah pengaturan sekolah')

// ===== Persiapan: semester lalu dengan berkas jawaban =====
const admin = await login(process.env.ADMIN_LOGIN, process.env.ADMIN_PASSWORD)
const tag = rnd(4)
const oldYear = 2000 + Number(tag.slice(0, 2)) % 20
const yid = must(await admin.rpc('admin_create_academic_year', { p_name: `${oldYear}/${oldYear + 1}`, p_start_date: `${oldYear}-07-13`, p_end_date: `${oldYear + 1}-06-30` })).toString()
const oldSem = must(await admin.from('semesters').select('id').eq('academic_year_id', yid).eq('number', 1).single())
const cls = must(await admin.from('classes').insert({ academic_year_id: yid, grade: 7, name: `ARSIP-${tag}` }).select('id').single())
must(await admin.from('subjects').upsert([{ code: 'PRK', name: 'Prakarya' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'PRK').single())
const nis = rnd(10), tUser = `guru8${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: { action: 'bulk_create', rows: [{ username: tUser, full_name: 'Guru Tahap Delapan', roles: ['teacher'], teacher: {} }, { username: nis, full_name: 'Siswa Arsip', roles: ['student'], student: { nisn: nis, gender: 'P' } }] },
})
const pw = Object.fromEntries(bulk.results.map((r) => [r.username, r.password]))
const studentId = must(await admin.from('v_students').select('id').eq('username', nis).single()).id
must(await admin.from('class_enrollments').insert({ class_id: cls.id, student_id: studentId, academic_year_id: yid }))
const teacherId = must(await admin.from('v_teachers').select('id').eq('username', tUser).single()).id
const ta = must(await admin.from('teaching_assignments').insert({ teacher_id: teacherId, class_id: cls.id, subject_id: subj.id, semester_id: oldSem.id }).select('id').single())
const guru = await login(tUser, pw[tUser])
const task = must(await guru.from('assignments').insert({ teaching_assignment_id: ta.id, title: 'Karya lama', submission_types: ['file', 'text'], start_at: `${oldYear}-08-01T00:00:00Z`, due_at: `${oldYear}-08-10T00:00:00Z`, allow_late: true, status: 'published', description: 'x' }).select('id').single())
const s = await login(nis, pw[nis])
const path = `${ta.id}/${task.id}/siswa/${studentId}/karya-${tag}.pdf`
check(!(await s.storage.from(BUCKET).upload(path, new Blob(['%PDF-1.4\n% arsip\n%%EOF\n'], { type: 'application/pdf' }), { contentType: 'application/pdf' })).error, 'siswa mengunggah berkas jawaban')
must(await s.rpc('save_submission', { p_assignment_id: task.id, p_action: 'submit', p_text: 'Penjelasan karya', p_files: [{ storage_path: path, size_bytes: 24, file_name: 'karya.pdf' }] }))
must(await guru.from('assignment_grades').insert({ assignment_id: task.id, student_id: studentId, score: 88 }))
must(await guru.rpc('publish_grades', { p_assignment_id: task.id }))

// ===== Pembersihan =====
check(Boolean((await guru.rpc('admin_submission_files_by_semester')).error), 'guru tidak bisa membuka fitur pembersihan')
const sum = must(await admin.rpc('admin_submission_files_by_semester')).find((r) => r.semester_id === oldSem.id)
check(sum && sum.ended && sum.files === 1 && Number(sum.total_bytes) === 24, 'ringkasan berkas semester lalu')
const active = must(await admin.rpc('get_my_context')).active_semester
if (active) check(Boolean((await admin.rpc('admin_submission_file_paths', { p_semester_id: active.id })).error), 'semester aktif tidak bisa dibersihkan')
const paths = must(await admin.rpc('admin_submission_file_paths', { p_semester_id: oldSem.id }))
check(paths.length === 1 && paths[0] === path, 'daftar berkas yang akan dihapus')
const removed = must(await admin.storage.from(BUCKET).remove(paths))
check(removed.length === 1, 'admin menghapus berkas dari Storage')
check(must(await admin.rpc('admin_mark_submission_files_purged', { p_semester_id: oldSem.id, p_files: 1, p_bytes: 24 })) === 1, 'pengumpulan ditandai sudah dibersihkan')
check(Boolean((await s.storage.from(BUCKET).createSignedUrl(path, 60)).error), 'berkas sudah tidak ada di Storage')
const sub = must(await guru.from('assignment_submissions').select('text_answer, files, files_purged_at').eq('assignment_id', task.id).single())
check(sub.text_answer === 'Penjelasan karya' && sub.files.length === 0 && sub.files_purged_at, 'jawaban teks tetap, daftar berkas dikosongkan')
check(Number(must(await guru.from('assignment_grades').select('score').eq('assignment_id', task.id).single()).score) === 88, 'nilai tetap tersimpan')
const { data: logs } = await admin.from('audit_logs').select('action').eq('action', 'storage.purge_submissions').limit(1)
check(logs.length === 1, 'pembersihan tercatat di audit log')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
