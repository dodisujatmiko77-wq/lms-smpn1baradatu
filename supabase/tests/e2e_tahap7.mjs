// Uji ujung-ke-ujung Tahap 7 (monitoring & laporan) lewat API — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap7.mjs
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.ANON_KEY
const DOMAIN = process.env.LOGIN_EMAIL_DOMAIN ?? 'lms.smpn1baradatu.sch.id'
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
const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString()

const admin = await login(process.env.ADMIN_LOGIN, process.env.ADMIN_PASSWORD)
let ctx = must(await admin.rpc('get_my_context'))
if (!ctx.active_semester) {
  const y = 2300 + Math.floor(Math.random() * 500)
  const yid = must(await admin.rpc('admin_create_academic_year', { p_name: `${y}/${y + 1}`, p_start_date: `${y}-07-13`, p_end_date: `${y + 1}-06-30` }))
  const s = must(await admin.from('semesters').select('id').eq('academic_year_id', yid).eq('number', 1).single())
  must(await admin.rpc('set_active_semester', { p_semester_id: s.id }))
  ctx = must(await admin.rpc('get_my_context'))
}
const sem = ctx.active_semester
const tag = rnd(4)
const cls = must(await admin.from('classes').insert({ academic_year_id: sem.academic_year_id, grade: 9, name: `IX-L${tag}` }).select('id').single())
must(await admin.from('subjects').upsert([{ code: 'PKN', name: 'Pendidikan Pancasila' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'PKN').single())
const nisA = rnd(10), nisB = rnd(10), tUser = `guru7${tag}`, gUser = `wali7${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: {
    action: 'bulk_create',
    rows: [
      { username: tUser, full_name: 'Guru Tahap Tujuh', roles: ['teacher'], teacher: {} },
      { username: gUser, full_name: 'Wali Tahap Tujuh', roles: ['teacher'], teacher: {} },
      { username: nisA, full_name: 'Aulia', roles: ['student'], student: { nisn: nisA, gender: 'P', class_id: cls.id } },
      { username: nisB, full_name: 'Bayu', roles: ['student'], student: { nisn: nisB, gender: 'L', class_id: cls.id } },
    ],
  },
})
const pw = Object.fromEntries(bulk.results.map((r) => [r.username, r.password]))
const teacherId = must(await admin.from('v_teachers').select('id').eq('username', tUser).single()).id
const waliId = must(await admin.from('v_teachers').select('id').eq('username', gUser).single()).id
const ta = must(await admin.from('teaching_assignments').insert({ teacher_id: teacherId, class_id: cls.id, subject_id: subj.id, semester_id: sem.id }).select('id').single())
must(await admin.from('class_guardians').insert({ class_id: cls.id, teacher_id: waliId, semester_id: sem.id }))
const guru = await login(tUser, pw[tUser])
const wali = await login(gUser, pw[gUser])
const sA = await login(nisA, pw[nisA])
const sB = await login(nisB, pw[nisB])
const ids = {
  A: must(await sA.rpc('get_my_context')).student_id,
  B: must(await sB.rpc('get_my_context')).student_id,
}

// ===== Aktivitas belajar =====
const lesson = must(await guru.from('lessons').insert({ teaching_assignment_id: ta.id, title: 'Nilai Pancasila', status: 'published', content_html: '<p>x</p>' }).select('id').single())
must(await sA.rpc('mark_lesson_progress', { p_lesson_id: lesson.id, p_action: 'complete' }))
const task = must(await guru.from('assignments').insert({ teaching_assignment_id: ta.id, title: 'Esai sila ke-3', submission_types: ['text'], start_at: iso(-48), due_at: iso(24), max_score: 100, status: 'published', description: 'x' }).select('id').single())
must(await sA.rpc('save_submission', { p_assignment_id: task.id, p_action: 'submit', p_text: 'Persatuan Indonesia…' }))
must(await guru.from('assignment_grades').insert({ assignment_id: task.id, student_id: ids.A, score: 85 }))
must(await guru.from('assignment_grades').insert({ assignment_id: task.id, student_id: ids.B, score: 60 }))
must(await guru.rpc('publish_grades', { p_assignment_id: task.id }))

// ===== Laporan kelas =====
const sum = must(await wali.rpc('report_class_summary', { p_class_id: cls.id }))
check(sum.length === 2 && Number(sum.find((r) => r.student_id === ids.A).overall_avg) === 85, 'wali kelas: rekap kelas (Aulia 85)')
check(sum.find((r) => r.student_id === ids.A).lessons_done === 1, 'rekap kelas memuat penyelesaian materi')
check(Boolean((await sA.rpc('report_class_summary', { p_class_id: cls.id })).error), 'siswa tidak bisa membuka laporan kelas')
check(must(await wali.rpc('get_report_classes')).some((c) => c.id === cls.id && c.is_guardian), 'daftar kelas laporan wali kelas')

// ===== Rekap nilai mapel =====
const grades = must(await guru.rpc('report_ta_grades', { p_ta_id: ta.id }))
check(grades.columns.length === 1 && grades.students.length === 2 && Number(grades.students.find((s) => s.id === ids.B).scores[task.id].pct) === 60, 'guru: rekap nilai per tugas (Bayu 60)')
check(grades.kkm === 75, 'KKM bawaan 75 ikut dikirim')

// ===== Monitoring =====
const mon = must(await admin.rpc('monitor_learning'))
const row = mon.find((r) => r.teaching_assignment_id === ta.id)
check(row && row.lessons_published === 1 && Number(row.avg_completion) === 50 && row.active_students_7d >= 1, 'admin: monitoring pembelajaran (1 materi, 50% selesai, siswa aktif)')
check(must(await guru.rpc('monitor_learning')).length === 1, 'guru hanya memantau kelasnya')
const asg = must(await wali.rpc('monitor_assignments', { p_class_id: cls.id }))
check(asg.length === 1 && asg[0].submitted === 1 && asg[0].graded === 2 && asg[0].grades_published === 2, 'wali kelas: monitoring tugas (1 kumpul, 2 dinilai & terbit)')
check(must(await wali.rpc('assignment_missing_students', { p_assignment_id: task.id })).length === 0, 'siswa yang sudah dinilai tidak dihitung belum mengumpulkan')

// ===== Tindak lanjut =====
const fu = must(await wali.rpc('class_followups', { p_class_id: cls.id }))
const bayu = fu.find((f) => f.student_id === ids.B)
check(fu[0].student_id === ids.B && bayu.reasons.some((x) => x.includes('KKM')), 'tindak lanjut: Bayu (nilai 60 < KKM) di urutan teratas')
check(bayu.reasons.some((x) => x.includes('materi')), 'alasan: penyelesaian materi rendah')
check(Boolean((await guru.rpc('class_followups', { p_class_id: cls.id })).error), 'guru mapel (bukan wali) tidak bisa membuka daftar tindak lanjut')

// ===== Aktivitas & laporan siswa =====
const act = must(await admin.rpc('activity_daily', { p_days: 7 }))
check(act.length === 7 && act.at(-1).student_events >= 2 && act.at(-1).teacher_events >= 3, 'grafik aktivitas hari ini: aktivitas siswa & guru tercatat')
check(must(await admin.rpc('teacher_activity', { p_days: 30 })).find((t) => t.teacher_id === teacherId).grades === 2, 'keaktifan guru: 2 penilaian')
check(Boolean((await guru.rpc('activity_daily', { p_days: 7 })).error), 'guru tidak bisa melihat grafik seluruh sekolah')
const rep = must(await wali.rpc('get_student_report', { p_student_id: ids.A }))
check(rep.subjects.length === 1 && rep.tasks[0].status === 'graded' && Number(rep.tasks[0].score) === 85, 'laporan siswa: mapel & status tugas')
check(rep.badges.length === 0 || rep.badges.every((b) => b.name), 'laporan siswa memuat badge')
check(Boolean((await sB.rpc('get_student_report', { p_student_id: ids.A })).error), 'siswa tidak bisa melihat laporan teman')
check(Boolean((await admin.from('activity_events').select('id').limit(1)).error), 'log aktivitas tidak bisa dibaca langsung lewat API')

// ===== KKM bisa diubah admin =====
must(await admin.from('school_settings').update({ kkm: 55 }).eq('id', true))
check(!must(await wali.rpc('class_followups', { p_class_id: cls.id })).find((f) => f.student_id === ids.B).reasons.some((x) => x.includes('KKM')), 'KKM diturunkan ke 55 → Bayu tidak lagi di bawah KKM')
must(await admin.from('school_settings').update({ kkm: 75 }).eq('id', true))

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
