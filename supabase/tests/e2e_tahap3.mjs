// Uji ujung-ke-ujung Tahap 3 (ruang kelas, materi, storage, progress) — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap3.mjs
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
const pdf = (text) => new Blob([`%PDF-1.4\n% ${text}\n%%EOF\n`], { type: 'application/pdf' })

const admin = await login(process.env.ADMIN_LOGIN, process.env.ADMIN_PASSWORD)
let ctx = must(await admin.rpc('get_my_context'))
if (!ctx.active_semester) {
  const y = 2200 + Math.floor(Math.random() * 500)
  const yid = must(await admin.rpc('admin_create_academic_year', { p_name: `${y}/${y + 1}`, p_start_date: `${y}-07-13`, p_end_date: `${y + 1}-06-30` }))
  const s = must(await admin.from('semesters').select('id').eq('academic_year_id', yid).eq('number', 1).single())
  must(await admin.rpc('set_active_semester', { p_semester_id: s.id }))
  ctx = must(await admin.rpc('get_my_context'))
}
const sem = ctx.active_semester
const tag = rnd(4)
const classes = must(await admin.from('classes').insert([{ academic_year_id: sem.academic_year_id, grade: 9, name: `IX-T${tag}` }, { academic_year_id: sem.academic_year_id, grade: 9, name: `IX-U${tag}` }]).select('id, name'))
must(await admin.from('subjects').upsert([{ code: 'MTK', name: 'Matematika' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'MTK').single())

const nisA = rnd(10), nisB = rnd(10), tUser = `guru3${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: {
    action: 'bulk_create',
    rows: [
      { username: tUser, full_name: 'Guru Tahap Tiga', roles: ['teacher'], teacher: {} },
      { username: nisA, full_name: 'Siswa Kelas T', roles: ['student'], student: { nisn: nisA, gender: 'P', class_id: classes[0].id } },
      { username: nisB, full_name: 'Siswa Kelas U', roles: ['student'], student: { nisn: nisB, gender: 'L', class_id: classes[1].id } },
    ],
  },
})
const pw = Object.fromEntries(bulk.results.map((r) => [r.username, r.password]))
const teacherId = must(await admin.from('v_teachers').select('id').eq('username', tUser).single()).id
const [ta, taOther] = must(
  await admin.from('teaching_assignments').insert([
    { teacher_id: teacherId, class_id: classes[0].id, subject_id: subj.id, semester_id: sem.id },
    { teacher_id: teacherId, class_id: classes[1].id, subject_id: subj.id, semester_id: sem.id },
  ]).select('id'),
)

// ===== Guru menyusun materi =====
const guru = await login(tUser, pw[tUser])
const course = must(await guru.rpc('get_course', { p_ta_id: ta.id }))
check(course.can_manage && course.class_name === `IX-T${tag}`, 'guru membuka ruang kelasnya (can_manage)')
const section = must(await guru.from('course_sections').insert({ teaching_assignment_id: ta.id, title: 'Bab 1: Bilangan' }).select().single())
const lesson = must(await guru.from('lessons').insert({ teaching_assignment_id: ta.id, section_id: section.id, meeting_number: 1, title: 'Bilangan Bulat', content_html: '<p>Materi <script>alert(1)</script></p>', status: 'draft' }).select().single())
const path = `${ta.id}/${lesson.id}/modul-${tag}.pdf`
const up = await guru.storage.from('materials').upload(path, pdf(`modul ${tag}`), { contentType: 'application/pdf' })
check(!up.error, `guru mengunggah PDF ke storage (${up.error?.message ?? 'ok'})`)
must(await guru.from('lesson_materials').insert({ lesson_id: lesson.id, type: 'pdf', title: 'Modul', storage_path: path, file_name: 'modul.pdf', size_bytes: 40 }))
must(await guru.from('lesson_materials').insert({ lesson_id: lesson.id, type: 'video', title: 'Video', url: 'https://youtu.be/dQw4w9WgXcQ' }))
const bad = await guru.storage.from('materials').upload(`${ta.id}/${lesson.id}/x-${tag}.html`, new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), { contentType: 'text/html' })
check(Boolean(bad.error), `berkas HTML ditolak bucket (${bad.error?.message})`)
const cross = await guru.storage.from('materials').upload(`${taOther.id}/${lesson.id}/y-${tag}.pdf`, pdf('x'), { contentType: 'application/pdf' })
check(Boolean(cross.error), 'path berkas yang tidak cocok dengan pertemuannya ditolak')

// ===== Siswa kelas T sebelum publikasi =====
const sA = await login(nisA, pw[nisA])
check((await sA.from('lessons').select('id').eq('teaching_assignment_id', ta.id)).data.length === 0, 'siswa tidak melihat pertemuan draf')
check(Boolean((await sA.storage.from('materials').createSignedUrl(path, 60)).error), 'siswa tidak bisa membuat link unduh berkas draf')

// ===== Publikasi =====
must(await guru.from('lessons').update({ status: 'published' }).eq('id', lesson.id))
const lessonsA = must(await sA.from('lessons').select('id, content_html, lesson_materials(*)').eq('teaching_assignment_id', ta.id))
check(lessonsA.length === 1 && lessonsA[0].lesson_materials.length === 2, 'setelah terbit, siswa melihat pertemuan & 2 materinya')
const signed = await sA.storage.from('materials').createSignedUrl(path, 60)
check(!signed.error, 'siswa mendapat signed URL berkas pertemuan terbit')
if (!signed.error) {
  const body = await (await fetch(signed.data.signedUrl)).text()
  check(body.includes(`modul ${tag}`), 'isi berkas yang diunduh siswa sesuai')
}
const up2 = await sA.storage.from('materials').upload(`${ta.id}/${lesson.id}/siswa-${tag}.pdf`, pdf('s'), { contentType: 'application/pdf' })
check(Boolean(up2.error), 'siswa tidak bisa mengunggah ke folder materi')
const del = await sA.storage.from('materials').remove([path])
const stillThere = await guru.storage.from('materials').createSignedUrl(path, 60)
check(!stillThere.error && (del.data ?? []).length === 0, 'siswa tidak bisa menghapus berkas materi')

// Progress
check((must(await sA.rpc('mark_lesson_progress', { p_lesson_id: lesson.id, p_action: 'open' }))).status === 'in_progress', 'siswa membuka pertemuan → sedang dipelajari')
check((must(await sA.rpc('mark_lesson_progress', { p_lesson_id: lesson.id, p_action: 'complete' }))).status === 'completed', 'siswa menandai selesai')
const mine = must(await sA.rpc('get_my_courses')).find((c) => c.teaching_assignment_id === ta.id)
check(mine?.lesson_count === 1 && mine?.completed_count === 1, 'progress mapel siswa 1/1')

// ===== Siswa kelas lain =====
const sB = await login(nisB, pw[nisB])
check(Boolean((await sB.storage.from('materials').createSignedUrl(path, 60)).error), 'siswa kelas lain tidak bisa mengunduh berkas kelas T')
check((await sB.rpc('get_course', { p_ta_id: ta.id })).data === null, 'siswa kelas lain tidak bisa membuka ruang kelas T')
check(Boolean((await sB.rpc('mark_lesson_progress', { p_lesson_id: lesson.id, p_action: 'complete' })).error), 'siswa kelas lain tidak bisa mencatat progress kelas T')

// ===== Guru memantau =====
const prog = must(await guru.rpc('get_course_progress', { p_ta_id: ta.id }))
check(prog.length === 1 && prog[0].completed === 1 && prog[0].total === 1, 'guru melihat progress siswa: 1/1 selesai')

// ===== Logo (bucket publik) =====
const png = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0))], { type: 'image/png' })
const logoPath = `school/logo-test-${tag}.png`
check(Boolean((await guru.storage.from('public-assets').upload(logoPath, png, { contentType: 'image/png' })).error), 'guru tidak bisa mengunggah logo sekolah')
const lu = await admin.storage.from('public-assets').upload(logoPath, png, { contentType: 'image/png' })
check(!lu.error, `admin mengunggah logo (${lu.error?.message ?? 'ok'})`)
const pub = admin.storage.from('public-assets').getPublicUrl(logoPath).data.publicUrl
check((await fetch(pub)).status === 200, 'logo dapat diakses publik (halaman login)')
await admin.storage.from('public-assets').remove([logoPath])

const usage = must(await admin.rpc('admin_storage_usage'))
check(usage.file_count >= 1 && usage.link_count >= 1, `admin melihat pemakaian penyimpanan (${usage.file_count} berkas, ${usage.total_bytes} byte)`)

// ===== Hapus pertemuan & berkas =====
must(await guru.storage.from('materials').remove([path]))
must(await guru.from('lessons').delete().eq('id', lesson.id))
check(Boolean((await guru.storage.from('materials').createSignedUrl(path, 60)).error), 'berkas terhapus dari storage bersama pertemuannya')
const { data: logs } = await admin.from('audit_logs').select('action').in('action', ['lessons.publish', 'lessons.delete']).order('id', { ascending: false }).limit(5)
check(logs.some((l) => l.action === 'lessons.publish') && logs.some((l) => l.action === 'lessons.delete'), 'publikasi & penghapusan pertemuan tercatat di audit log')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
