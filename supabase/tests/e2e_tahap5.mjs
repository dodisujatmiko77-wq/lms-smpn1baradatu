// Uji ujung-ke-ujung Tahap 5 (bank soal, kuis, CBT, penilaian) lewat API — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap5.mjs
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
const [cls] = must(await admin.from('classes').insert([{ academic_year_id: sem.academic_year_id, grade: 7, name: `VII-K${tag}` }]).select('id'))
must(await admin.from('subjects').upsert([{ code: 'MTK', name: 'Matematika' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'MTK').single())
const nisA = rnd(10), nisB = rnd(10), tUser = `guru5${tag}`, gUser = `wali5${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: {
    action: 'bulk_create',
    rows: [
      { username: tUser, full_name: 'Guru Tahap Lima', roles: ['teacher'], teacher: {} },
      { username: gUser, full_name: 'Wali Tahap Lima', roles: ['teacher'], teacher: {} },
      { username: nisA, full_name: 'Siswa A5', roles: ['student'], student: { nisn: nisA, gender: 'P', class_id: cls.id } },
      { username: nisB, full_name: 'Siswa B5', roles: ['student'], student: { nisn: nisB, gender: 'L', class_id: cls.id } },
    ],
  },
})
const pw = Object.fromEntries(bulk.results.map((r) => [r.username, r.password]))
const teacherId = must(await admin.from('v_teachers').select('id').eq('username', tUser).single()).id
const waliId = must(await admin.from('v_teachers').select('id').eq('username', gUser).single()).id
const ta = must(await admin.from('teaching_assignments').insert({ teacher_id: teacherId, class_id: cls.id, subject_id: subj.id, semester_id: sem.id }).select('id').single())
must(await admin.from('class_guardians').insert({ class_id: cls.id, teacher_id: waliId, semester_id: sem.id }))

// ===== Guru: bank soal =====
const guru = await login(tUser, pw[tUser])
const bank = must(await guru.from('question_banks').insert({ teacher_id: teacherId, subject_id: subj.id, grade: 7, name: `Bilangan ${tag}` }).select('id').single())
const ins = async (row, options = []) => {
  const q = must(await guru.from('quiz_questions').insert({ bank_id: bank.id, ...row }).select('id').single())
  if (options.length) must(await guru.from('quiz_options').insert(options.map((o, i) => ({ ...o, question_id: q.id, position: i }))))
  return q.id
}
const qMcq = await ins({ type: 'mcq', body: '-3 + 5 = ...', points: 2, position: 1, explanation: 'Geser ke kanan.' }, [{ body: '2', is_correct: true }, { body: '-8', is_correct: false }, { body: '8', is_correct: false }])
const qTf = await ins({ type: 'true_false', body: '-7 < -2', answer_key: 'true', points: 1, position: 2 })
const qShort = await ins({ type: 'short', body: 'Lawan dari 9?', answer_key: '-9\nnegatif 9', points: 1, position: 3 })
const qEssay = await ins({ type: 'essay', body: 'Jelaskan penjumlahan bilangan negatif.', answer_key: 'Garis bilangan', points: 4, position: 4 })
const banks = must(await guru.from('question_banks').select('id, questions:quiz_questions(count)').eq('id', bank.id))
check(banks[0]?.questions?.[0]?.count === 4, 'daftar bank soal menghitung jumlah soal (embed count)')
const opts = must(await guru.from('quiz_options').select('id, is_correct').eq('question_id', qMcq))
const right = opts.find((o) => o.is_correct).id
const wrong = opts.find((o) => !o.is_correct).id

// ===== Guru: kuis =====
const quiz = must(await guru.from('quizzes').insert({ teaching_assignment_id: ta.id, title: `Kuis ${tag}`, open_at: iso(-1), close_at: iso(24), duration_minutes: 15, max_attempts: 1, review_mode: 'after_submit' }).select('id').single())
check(Boolean((await guru.from('quizzes').update({ status: 'published' }).eq('id', quiz.id)).error), 'kuis tanpa soal tidak bisa diterbitkan')
must(await guru.from('quiz_question_items').insert([qMcq, qTf, qShort, qEssay].map((id, i) => ({ quiz_id: quiz.id, question_id: id, position: i }))))
must(await guru.from('quizzes').update({ status: 'published' }).eq('id', quiz.id))

// ===== Siswa =====
const sA = await login(nisA, pw[nisA])
const sB = await login(nisB, pw[nisB])
const mine = must(await sA.rpc('get_my_quizzes'))
check(mine.some((q) => q.id === quiz.id && q.question_count === 4), 'siswa melihat kuis terbit (4 soal)')
check(must(await sA.from('quiz_questions').select('id')).length === 0, 'siswa tidak bisa membaca bank soal lewat API')
check(must(await sA.from('quiz_options').select('id, is_correct')).length === 0, 'siswa tidak bisa membaca kunci pilihan ganda lewat API')
const attemptId = must(await sA.rpc('start_quiz_attempt', { p_quiz_id: quiz.id }))
const att = must(await sA.rpc('get_attempt', { p_attempt_id: attemptId }))
const raw = JSON.stringify(att)
check(att.questions.length === 4 && !raw.includes('is_correct') && !raw.includes('negatif 9') && !raw.includes('Garis bilangan'), 'soal yang dikirim ke siswa tidak memuat kunci jawaban')
check(Math.abs(new Date(att.server_now) - Date.now()) < 60_000 && new Date(att.deadline_at) > new Date(att.server_now), 'waktu server & batas waktu dikirim')
check(must(await sA.from('quiz_attempts').select('id')).length === 0, 'siswa tidak bisa membaca tabel percobaan langsung')
must(await sA.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: qMcq, p_option_id: wrong }))
must(await sA.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: qMcq, p_option_id: right }))
must(await sA.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: qTf, p_text: 'false' }))
must(await sA.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: qShort, p_text: 'Negatif 9' }))
must(await sA.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: qEssay, p_text: 'Pakai garis bilangan ke kiri.' }))
check(Boolean((await sB.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: qMcq, p_option_id: wrong })).error), 'siswa lain tidak bisa mengubah jawaban')
check(Boolean((await sA.rpc('get_attempt_result', { p_attempt_id: attemptId })).error), 'hasil tidak tersedia sebelum dikumpulkan')
must(await sA.rpc('report_focus_lost', { p_attempt_id: attemptId }))
must(await sA.rpc('submit_quiz_attempt', { p_attempt_id: attemptId }))
const res = must(await sA.rpc('get_attempt_result', { p_attempt_id: attemptId }))
check(Number(res.score_total) === 3 && res.needs_manual, `nilai otomatis 3/8 (PG benar, B/S salah, isian benar) + esai menunggu (${res.score_total})`)
check(res.review_available && res.review.find((q) => q.id === qMcq).options.some((o) => o.is_correct), 'pembahasan & kunci tampil setelah mengumpulkan (mode setelah kumpul)')
check(Boolean((await sA.rpc('start_quiz_attempt', { p_quiz_id: quiz.id })).error), 'batas 1 percobaan ditegakkan')
check(must(await sA.rpc('get_my_quiz_attempts', { p_quiz_id: quiz.id })).length === 1, 'riwayat percobaan siswa')

// ===== Guru menilai =====
check(must(await guru.rpc('get_quiz_grading_queue')).some((r) => r.quiz_id === quiz.id && r.waiting === 1), 'antrean esai guru berisi kuis ini')
const results = must(await guru.rpc('get_quiz_results', { p_quiz_id: quiz.id }))
const rowA = results.find((r) => r.attempts === 1)
check(results.length === 2 && rowA.focus_lost === 1, 'hasil per siswa (2 siswa, 1× keluar halaman tercatat)')
const detail = must(await guru.rpc('get_attempt_detail', { p_attempt_id: attemptId }))
check(detail.questions.find((q) => q.id === qShort).answer_key.includes('negatif 9'), 'guru melihat kunci & jawaban siswa')
const wali = await login(gUser, pw[gUser])
check(must(await wali.rpc('get_quiz_results', { p_quiz_id: quiz.id })).length === 2, 'wali kelas memantau hasil kuis')
check(Boolean((await wali.rpc('grade_essay', { p_attempt_id: attemptId, p_question_id: qEssay, p_score: 4 })).error), 'wali kelas tidak bisa menilai esai')
check(Boolean((await guru.rpc('grade_essay', { p_attempt_id: attemptId, p_question_id: qEssay, p_score: 9 })).error), 'nilai esai melebihi skor soal ditolak')
const g = must(await guru.rpc('grade_essay', { p_attempt_id: attemptId, p_question_id: qEssay, p_score: 3.5 }))
check(Number(g.score_total) === 6.5 && !g.needs_manual, 'nilai esai menambah total (3 + 3,5 = 6,5)')
check(Number(must(await sA.rpc('get_my_quizzes')).find((q) => q.id === quiz.id).best_score) === 6.5, 'siswa melihat nilai akhir')
check(Boolean((await guru.from('quiz_options').update({ is_correct: false }).eq('id', right)).error), 'kunci soal yang sudah dikerjakan terkunci')
check(Boolean((await guru.from('quiz_question_items').delete().eq('quiz_id', quiz.id)).error), 'soal tidak bisa dicabut dari kuis yang sudah dikerjakan')

// ===== Reset percobaan & hapus kuis =====
must(await guru.rpc('reset_quiz_attempt', { p_attempt_id: attemptId }))
const again = await sA.rpc('start_quiz_attempt', { p_quiz_id: quiz.id })
check(!again.error, 'setelah direset guru, siswa bisa mengerjakan lagi')
must(await guru.from('quizzes').delete().eq('id', quiz.id))
check(!must(await sA.rpc('get_my_quizzes')).some((q) => q.id === quiz.id), 'kuis terhapus dari daftar siswa')
check(!(await guru.from('question_banks').delete().eq('id', bank.id)).error, 'bank soal bisa dihapus setelah tidak dipakai kuis')
const { data: logs } = await admin.from('audit_logs').select('action').in('action', ['quizzes.publish', 'quiz_answers.grade', 'quiz_attempts.reset', 'quizzes.delete']).order('id', { ascending: false }).limit(20)
const acts = new Set(logs.map((l) => l.action))
check(['quizzes.publish', 'quiz_answers.grade', 'quiz_attempts.reset', 'quizzes.delete'].every((a) => acts.has(a)), 'penerbitan, penilaian esai, reset & penghapusan kuis tercatat di audit log')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
