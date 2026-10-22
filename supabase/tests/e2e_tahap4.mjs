// Uji ujung-ke-ujung Tahap 4 (tugas, pengumpulan, nilai, storage) — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap4.mjs
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
const pdf = (t) => new Blob([`%PDF-1.4\n% ${t}\n%%EOF\n`], { type: 'application/pdf' })
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
const [cls] = must(await admin.from('classes').insert([{ academic_year_id: sem.academic_year_id, grade: 8, name: `VIII-T${tag}` }]).select('id'))
must(await admin.from('subjects').upsert([{ code: 'IPA', name: 'Ilmu Pengetahuan Alam' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'IPA').single())
const nisA = rnd(10), nisB = rnd(10), tUser = `guru4${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: {
    action: 'bulk_create',
    rows: [
      { username: tUser, full_name: 'Guru Tahap Empat', roles: ['teacher'], teacher: {} },
      { username: nisA, full_name: 'Siswa A4', roles: ['student'], student: { nisn: nisA, gender: 'P', class_id: cls.id } },
      { username: nisB, full_name: 'Siswa B4', roles: ['student'], student: { nisn: nisB, gender: 'L', class_id: cls.id } },
    ],
  },
})
const pw = Object.fromEntries(bulk.results.map((r) => [r.username, r.password]))
const teacherId = must(await admin.from('v_teachers').select('id').eq('username', tUser).single()).id
const ta = must(await admin.from('teaching_assignments').insert({ teacher_id: teacherId, class_id: cls.id, subject_id: subj.id, semester_id: sem.id }).select('id').single())

// ===== Guru membuat tugas + lampiran =====
const guru = await login(tUser, pw[tUser])
const task = must(await guru.from('assignments').insert({ teaching_assignment_id: ta.id, title: 'Laporan pengamatan', submission_types: ['text', 'file'], start_at: iso(-1), due_at: iso(48), max_score: 100, status: 'draft' }).select().single())
const attPath = `${ta.id}/${task.id}/lampiran/lkpd-${tag}.pdf`
check(!(await guru.storage.from(BUCKET).upload(attPath, pdf('LKPD'), { contentType: 'application/pdf' })).error, 'guru mengunggah lampiran tugas')
must(await guru.from('assignments').update({ attachments: [{ id: 'a1', type: 'pdf', title: 'LKPD', storage_path: attPath, size_bytes: 30 }] }).eq('id', task.id))
const strict = must(await guru.from('assignments').insert({ teaching_assignment_id: ta.id, title: 'Tugas ketat', submission_types: ['link'], start_at: iso(-72), due_at: iso(-1), allow_late: false, status: 'published' }).select().single())

// ===== Siswa sebelum terbit =====
const sA = await login(nisA, pw[nisA])
const sB = await login(nisB, pw[nisB])
check(!must(await sA.rpc('get_my_assignments')).some((t) => t.id === task.id), 'siswa tidak melihat tugas draf')
check(Boolean((await sA.storage.from(BUCKET).createSignedUrl(attPath, 60)).error), 'siswa tidak bisa membuka lampiran tugas draf')

must(await guru.from('assignments').update({ status: 'published' }).eq('id', task.id))
check(must(await sA.rpc('get_my_assignments')).some((t) => t.id === task.id), 'setelah terbit, tugas muncul di daftar siswa')
check(!(await sA.storage.from(BUCKET).createSignedUrl(attPath, 60)).error, 'siswa membuka lampiran tugas terbit')

// ===== Siswa A mengerjakan =====
const myPath = `${ta.id}/${task.id}/siswa/${(must(await sA.rpc('get_my_context'))).student_id}/jawaban-${tag}.pdf`
const bId = must(await sB.rpc('get_my_context')).student_id
check(!(await sA.storage.from(BUCKET).upload(myPath, pdf('jawaban A'), { contentType: 'application/pdf' })).error, 'siswa mengunggah berkas jawaban ke foldernya')
check(Boolean((await sA.storage.from(BUCKET).upload(`${ta.id}/${task.id}/siswa/${bId}/palsu.pdf`, pdf('x'), { contentType: 'application/pdf' })).error), 'siswa tidak bisa mengunggah ke folder siswa lain')
const files = [{ storage_path: myPath, file_name: 'jawaban.pdf', size_bytes: 30, type: 'pdf' }]
check(must(await sA.rpc('save_submission', { p_assignment_id: task.id, p_action: 'save', p_text: 'Draf', p_files: files })).status === 'draft', 'menyimpan draf jawaban')
const sub = must(await sA.rpc('save_submission', { p_assignment_id: task.id, p_action: 'submit', p_text: 'Hasil pengamatan saya…', p_files: files }))
check(sub.status === 'submitted' && sub.is_late === false, 'mengumpulkan tepat waktu')
check(Boolean((await sA.storage.from(BUCKET).upload(`${myPath}.v2.pdf`, pdf('v2'), { contentType: 'application/pdf' })).error), 'setelah terkumpul, siswa tidak bisa menambah berkas')
check(Boolean((await sB.storage.from(BUCKET).createSignedUrl(myPath, 60)).error), 'siswa lain tidak bisa membuka berkas jawaban teman')
check((await sB.from('assignment_submissions').select('id')).data.length === 0, 'siswa lain tidak melihat pengumpulan teman')
check(must(await sA.rpc('save_submission', { p_assignment_id: task.id, p_action: 'unsubmit' })).status === 'draft', 'membatalkan pengumpulan')
must(await sA.rpc('save_submission', { p_assignment_id: task.id, p_action: 'submit', p_text: 'Hasil pengamatan final', p_files: files }))
const late = await sA.rpc('save_submission', { p_assignment_id: strict.id, p_action: 'submit', p_link: 'https://docs.google.com/x' })
check(Boolean(late.error) && /tenggat/i.test(late.error.message), `tugas ketat setelah tenggat ditolak (${late.error?.message})`)

// ===== Guru menilai =====
const queue = must(await guru.rpc('get_grading_queue'))
check(queue.find((q) => q.assignment_id === task.id)?.waiting === 1, 'antrean pemeriksaan: 1 jawaban menunggu')
const board = must(await guru.rpc('get_assignment_board', { p_assignment_id: task.id }))
check(board.length === 2 && board.find((b) => b.nisn === nisA)?.submission_status === 'submitted', 'papan pemeriksaan: 2 siswa, siswa A terkumpul')
check(!(await guru.storage.from(BUCKET).createSignedUrl(myPath, 60)).error, 'guru membuka berkas jawaban siswa')
const aId = must(await sA.rpc('get_my_context')).student_id
must(await guru.from('assignment_grades').upsert({ assignment_id: task.id, student_id: aId, score: 85, feedback: 'Bagus, tambahkan kesimpulan.' }, { onConflict: 'assignment_id,student_id' }))
must(await guru.from('assignment_grades').upsert({ assignment_id: task.id, student_id: bId, score: 0, feedback: 'Tidak mengumpulkan.' }, { onConflict: 'assignment_id,student_id' }))
const over = await guru.from('assignment_grades').upsert({ assignment_id: task.id, student_id: aId, score: 150 }, { onConflict: 'assignment_id,student_id' })
check(Boolean(over.error), 'nilai melebihi maksimum ditolak')
check(must(await sA.rpc('get_my_assignments')).find((t) => t.id === task.id).score === null, 'nilai belum terlihat siswa sebelum diterbitkan')
check(must(await guru.rpc('publish_grades', { p_assignment_id: task.id })) === 2, 'guru menerbitkan 2 nilai')
const mineA = must(await sA.rpc('get_my_assignments')).find((t) => t.id === task.id)
check(Number(mineA.score) === 85 && mineA.feedback.startsWith('Bagus'), 'siswa melihat nilai 85 & umpan balik')
check(Boolean((await sA.rpc('save_submission', { p_assignment_id: task.id, p_action: 'save', p_text: 'ubah' })).error), 'tugas yang dinilai terkunci')
check((await sB.from('assignment_grades').select('score')).data.length === 1, 'siswa hanya melihat nilainya sendiri')
check(must(await guru.rpc('get_course_assignments', { p_ta_id: ta.id })).find((t) => t.id === task.id).grades_published === 2, 'ringkasan tugas guru: 2 nilai terbit')

// ===== Hapus tugas & berkas =====
const removed = must(await guru.storage.from(BUCKET).remove([attPath, myPath]))
check(removed.length === 2, `guru menghapus lampiran & berkas jawaban siswa (${removed.length}/2)`)
must(await guru.from('assignments').delete().eq('id', task.id))
check(Boolean((await guru.storage.from(BUCKET).createSignedUrl(myPath, 60)).error), 'berkas tugas terhapus dari storage')
const { data: logs } = await admin.from('audit_logs').select('action').in('action', ['assignments.publish', 'assignment_grades.publish', 'assignments.delete', 'assignment_grades.insert']).order('id', { ascending: false }).limit(20)
const acts = new Set(logs.map((l) => l.action))
check(['assignments.publish', 'assignment_grades.publish', 'assignments.delete', 'assignment_grades.insert'].every((a) => acts.has(a)), 'tugas, nilai & penerbitan nilai tercatat di audit log')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
