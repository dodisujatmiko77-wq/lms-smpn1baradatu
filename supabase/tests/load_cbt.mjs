// Uji beban sederhana: banyak siswa mengerjakan ujian online (CBT) bersamaan.
// HANYA untuk stack lokal/uji — membuat akun & data sendiri, dan membutuhkan JWT_SECRET
// agar token siswa bisa dibuat tanpa membebani server login.
//
// SUPABASE_URL=... ANON_KEY=... JWT_SECRET=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... \
//   STUDENTS=150 QUESTIONS=20 node supabase/tests/load_cbt.mjs
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.ANON_KEY
const SECRET = process.env.JWT_SECRET
const N = Number(process.env.STUDENTS ?? 150)
const Q = Number(process.env.QUESTIONS ?? 20)
const DOMAIN = process.env.LOGIN_EMAIL_DOMAIN ?? 'lms.smpn1baradatu.sch.id'
if (!SECRET) throw new Error('JWT_SECRET wajib diisi (uji beban hanya untuk stack lokal).')

const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(sub) {
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
}
const asUser = (sub) => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${jwt(sub)}` } } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

// ---------- Persiapan ----------
const admin = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
must(await admin.auth.signInWithPassword({ email: `${process.env.ADMIN_LOGIN}@${DOMAIN}`, password: process.env.ADMIN_PASSWORD }))
let ctx = must(await admin.rpc('get_my_context'))
if (!ctx.active_semester) {
  const y = 2300 + Math.floor(Math.random() * 500)
  const yid = must(await admin.rpc('admin_create_academic_year', { p_name: `${y}/${y + 1}`, p_start_date: `${y}-07-13`, p_end_date: `${y + 1}-06-30` }))
  const s = must(await admin.from('semesters').select('id').eq('academic_year_id', yid).eq('number', 1).single())
  must(await admin.rpc('set_active_semester', { p_semester_id: s.id }))
  ctx = must(await admin.rpc('get_my_context'))
}
const tag = rnd(4)
const cls = must(await admin.from('classes').insert({ academic_year_id: ctx.active_semester.academic_year_id, grade: 9, name: `BEBAN-${tag}` }).select('id').single())
must(await admin.from('subjects').upsert([{ code: 'UJI', name: 'Uji Beban' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'UJI').single())
const tUser = `beban${tag}`
console.log(`Menyiapkan ${N} siswa, 1 guru, ${Q} soal…`)
const rows = [{ username: tUser, full_name: 'Guru Uji Beban', roles: ['teacher'], teacher: {} }]
for (let i = 0; i < N; i++) {
  const nisn = `9${tag}${String(i).padStart(5, '0')}`
  rows.push({ username: nisn, full_name: `Siswa Beban ${i + 1}`, roles: ['student'], student: { nisn, gender: i % 2 ? 'L' : 'P', class_id: cls.id } })
}
for (let i = 0; i < rows.length; i += 50) {
  const { data, error } = await admin.functions.invoke('admin-users', { body: { action: 'bulk_create', rows: rows.slice(i, i + 50) } })
  if (error || data.results.some((r) => !r.ok)) throw new Error('gagal membuat akun: ' + (error?.message ?? JSON.stringify(data.results.find((r) => !r.ok))))
}
const teacher = must(await admin.from('v_teachers').select('id, profile_id').eq('username', tUser).single())
const students = must(await admin.from('v_students').select('id, profile_id').eq('class_id', cls.id))
const ta = must(await admin.from('teaching_assignments').insert({ teacher_id: teacher.id, class_id: cls.id, subject_id: subj.id, semester_id: ctx.active_semester.id }).select('id').single())
const guru = asUser(teacher.profile_id)
const bank = must(await guru.from('question_banks').insert({ teacher_id: teacher.id, subject_id: subj.id, name: 'Bank uji beban' }).select('id').single())
const qids = []
for (let i = 0; i < Q; i++) {
  const q = must(await guru.from('quiz_questions').insert({ bank_id: bank.id, type: 'mcq', body: `Soal ${i + 1}`, points: 1, position: i }).select('id').single())
  must(await guru.from('quiz_options').insert(['A', 'B', 'C', 'D'].map((b, k) => ({ question_id: q.id, body: b, is_correct: k === 0, position: k }))))
  qids.push(q.id)
}
const quiz = must(await guru.from('quizzes').insert({ teaching_assignment_id: ta.id, title: 'Ujian beban', open_at: new Date(Date.now() - 60_000).toISOString(), close_at: new Date(Date.now() + 3600_000).toISOString(), duration_minutes: 30 }).select('id').single())
must(await guru.from('quiz_question_items').insert(qids.map((id, i) => ({ quiz_id: quiz.id, question_id: id, position: i }))))
must(await guru.from('quizzes').update({ status: 'published' }).eq('id', quiz.id))

// ---------- Simulasi ----------
const lat = {}
let errors = 0
async function timed(name, fn) {
  const t = performance.now()
  const r = await fn()
  ;(lat[name] ??= []).push(performance.now() - t)
  if (r.error) {
    errors++
    if (errors <= 5) console.error(`  ! ${name}: ${r.error.message}`)
  }
  return r.data
}
async function student(s) {
  const c = asUser(s.profile_id)
  await sleep(Math.random() * 3000) // siswa menekan "Mulai" dalam rentang 3 detik
  await timed('get_my_quizzes', () => c.rpc('get_my_quizzes'))
  const attemptId = await timed('start_quiz_attempt', () => c.rpc('start_quiz_attempt', { p_quiz_id: quiz.id }))
  const att = await timed('get_attempt', () => c.rpc('get_attempt', { p_attempt_id: attemptId }))
  for (const q of att?.questions ?? []) {
    await sleep(200 + Math.random() * 600) // waktu membaca soal (dipercepat)
    const opt = q.options[Math.floor(Math.random() * q.options.length)]
    await timed('save_quiz_answer', () => c.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: q.id, p_option_id: opt.id }))
  }
  await timed('submit_quiz_attempt', () => c.rpc('submit_quiz_attempt', { p_attempt_id: attemptId }))
  await timed('get_attempt_result', () => c.rpc('get_attempt_result', { p_attempt_id: attemptId }))
}

console.log(`Mulai: ${students.length} siswa mengerjakan ${Q} soal bersamaan…`)
const t0 = performance.now()
await Promise.all(students.map(student))
const total = (performance.now() - t0) / 1000

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
console.log('\nRPC                     jumlah   p50(ms)  p95(ms)  maks(ms)')
for (const [name, arr] of Object.entries(lat)) {
  console.log(`${name.padEnd(22)} ${String(arr.length).padStart(7)} ${pct(arr, 50).toFixed(0).padStart(9)} ${pct(arr, 95).toFixed(0).padStart(8)} ${Math.max(...arr).toFixed(0).padStart(9)}`)
}
const requests = Object.values(lat).reduce((n, a) => n + a.length, 0)
const res = must(await guru.rpc('get_quiz_results', { p_quiz_id: quiz.id }))
const done = res.filter((r) => r.last_status === 'submitted').length
console.log(`\nTotal ${requests} permintaan dalam ${total.toFixed(1)} detik (${(requests / total).toFixed(0)} permintaan/detik), error: ${errors}`)
console.log(`Percobaan terkumpul & dinilai otomatis: ${done}/${students.length}`)
process.exit(errors || done !== students.length ? 1 : 0)
