// Uji ujung-ke-ujung Tahap 6 (notifikasi, pengumuman, forum, kalender, badge) lewat API — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_tahap6.mjs
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
const day = (d) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10)

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
const [cls, other] = must(await admin.from('classes').insert([
  { academic_year_id: sem.academic_year_id, grade: 8, name: `VIII-I${tag}` },
  { academic_year_id: sem.academic_year_id, grade: 8, name: `VIII-J${tag}` },
]).select('id'))
must(await admin.from('subjects').upsert([{ code: 'BIN', name: 'Bahasa Indonesia' }], { onConflict: 'code', ignoreDuplicates: true }))
const subj = must(await admin.from('subjects').select('id').eq('code', 'BIN').single())
const nisA = rnd(10), nisB = rnd(10), nisC = rnd(10), tUser = `guru6${tag}`, gUser = `wali6${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: {
    action: 'bulk_create',
    rows: [
      { username: tUser, full_name: 'Guru Tahap Enam', roles: ['teacher'], teacher: {} },
      { username: gUser, full_name: 'Wali Tahap Enam', roles: ['teacher'], teacher: {} },
      { username: nisA, full_name: 'Siswa A6', roles: ['student'], student: { nisn: nisA, gender: 'P', class_id: cls.id } },
      { username: nisB, full_name: 'Siswa B6', roles: ['student'], student: { nisn: nisB, gender: 'L', class_id: cls.id } },
      { username: nisC, full_name: 'Siswa C6', roles: ['student'], student: { nisn: nisC, gender: 'L', class_id: other.id } },
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
const sC = await login(nisC, pw[nisC])
const notifs = async (c) => must(await c.rpc('get_my_notifications', { p_limit: 50 }))

// ===== Notifikasi dari materi & tugas =====
must(await guru.from('lessons').insert({ teaching_assignment_id: ta.id, title: 'Teks eksposisi', status: 'published', content_html: '<p>x</p>' }))
const task = must(await guru.from('assignments').insert({ teaching_assignment_id: ta.id, title: 'Menulis eksposisi', submission_types: ['text'], start_at: iso(-1), due_at: iso(10), status: 'published', description: 'x' }).select('id').single())
let nA = await notifs(sA)
check(nA.some((n) => n.type === 'material' && n.link.includes('/pertemuan/')), 'siswa menerima notifikasi materi baru (dengan tautan)')
check(nA.some((n) => n.type === 'assignment') && nA.some((n) => n.type === 'deadline' && n.title.startsWith('Tenggat besok')), 'notifikasi tugas baru + pengingat tenggat H-1')
check((await notifs(sC)).length === 0, 'siswa kelas lain tidak menerima notifikasi')
check(must(await sA.from('notifications').select('id')).length === nA.length, 'tabel notifikasi bisa dibaca langsung (untuk realtime) hanya milik sendiri')
check(Boolean((await sA.from('notifications').update({ read_at: iso(0) }).eq('id', nA[0].id)).error), 'siswa tidak bisa mengubah notifikasi langsung (hanya lewat fungsi)')
const one = must(await sA.rpc('mark_notifications_read', { p_ids: [nA[0].id] }))
check(one === 1 && (await notifs(sA))[0].unread_total === nA.length - 1, 'tandai satu dibaca → jumlah belum dibaca berkurang')
must(await sA.rpc('mark_notifications_read', {}))
check((await notifs(sA))[0].unread_total === 0, 'tandai semua dibaca')

// ===== Pengumuman =====
check(Boolean((await guru.from('announcements').insert({ scope: 'school', title: 'x' })).error), 'guru tidak bisa membuat pengumuman sekolah')
must(await guru.from('announcements').insert({ scope: 'course', teaching_assignment_id: ta.id, title: 'Bawa kamus besok', body_html: '<p>Kamus <script>alert(1)</script>KBBI</p>' }))
must(await wali.from('announcements').insert({ scope: 'class', class_id: cls.id, title: 'Jadwal piket baru' }))
check(Boolean((await wali.from('announcements').insert({ scope: 'class', class_id: other.id, title: 'x' })).error), 'wali kelas hanya mengumumkan ke kelas binaannya')
must(await admin.from('announcements').insert({ scope: 'school', title: `Upacara ${tag}`, is_pinned: true }))
must(await admin.from('announcements').insert({ scope: 'school', title: `Terjadwal ${tag}`, publish_at: iso(48) }))
const annA = must(await sA.rpc('get_announcements', {}))
check(annA[0].title === `Upacara ${tag}` && annA.some((a) => a.title === 'Bawa kamus besok') && annA.some((a) => a.title === 'Jadwal piket baru'), 'siswa melihat pengumuman sekolah (disematkan di atas), kelas & mapel')
check(!annA.some((a) => a.title === `Terjadwal ${tag}`), 'pengumuman terjadwal belum terlihat siswa')
check(!must(await sC.rpc('get_announcements', {})).some((a) => a.title === 'Jadwal piket baru'), 'siswa kelas lain tidak melihat pengumuman kelas ini')
check((await notifs(sA)).filter((n) => n.type === 'announcement').length >= 3, 'pengumuman baru dikirim sebagai notifikasi')
const targets = must(await wali.rpc('get_announcement_targets'))
check(targets.length === 1 && targets[0].scope === 'class', 'target pengumuman wali kelas: kelas binaannya')

// ===== Forum =====
const topic = must(await sA.from('discussion_topics').insert({ teaching_assignment_id: ta.id, title: 'Ciri teks eksposisi?', body: 'Lihat https://kbbi.kemdikbud.go.id', is_pinned: true }).select('id, is_pinned').single())
check(!topic.is_pinned, 'siswa tidak bisa menyematkan topik')
check((await notifs(guru)).some((n) => n.type === 'forum' && n.link === `/diskusi/${topic.id}`), 'guru menerima notifikasi topik baru')
const r1 = must(await sB.from('discussion_replies').insert({ topic_id: topic.id, body: 'Ada tesis, argumentasi, penegasan.' }).select('id').single())
must(await guru.from('discussion_replies').insert({ topic_id: topic.id, parent_id: r1.id, body: 'Betul, tambahkan contohnya.' }))
check((await notifs(sA)).some((n) => n.type === 'forum' && n.title.startsWith('Balasan baru')), 'penulis topik menerima notifikasi balasan')
check((await notifs(sB)).some((n) => n.type === 'forum'), 'penulis balasan menerima notifikasi tanggapan atas balasannya')
const t1 = must(await sA.rpc('get_topic', { p_topic_id: topic.id }))
check(t1.replies.length === 2 && t1.replies[1].author_role === 'teacher' && !t1.can_moderate, 'topik + balasan dengan label peran; siswa bukan moderator')
check(Boolean((await sC.rpc('get_topic', { p_topic_id: topic.id })).error), 'siswa kelas lain tidak bisa membuka topik')
must(await guru.from('discussion_replies').update({ is_hidden: true }).eq('id', r1.id))
must(await guru.from('discussion_topics').update({ is_locked: true }).eq('id', topic.id))
check(must(await sA.rpc('get_topic', { p_topic_id: topic.id })).replies.length === 1, 'balasan yang disembunyikan guru tidak terlihat siswa lain')
check(Boolean((await sB.from('discussion_replies').insert({ topic_id: topic.id, body: 'lagi' })).error), 'topik terkunci tidak bisa dibalas')
check(must(await sA.rpc('get_course_topics', { p_ta_id: ta.id }))[0].reply_count === 1, 'daftar topik: jumlah balasan terlihat')

// ===== Kalender =====
must(await admin.from('calendar_events').insert({ scope: 'school', title: `PTS ${tag}`, category: 'exam', start_date: day(2), end_date: day(4) }))
must(await wali.from('calendar_events').insert({ scope: 'class', class_id: cls.id, title: 'Kerja bakti', category: 'activity', start_date: day(1), end_date: day(1) }))
check(Boolean((await guru.from('calendar_events').insert({ scope: 'school', title: 'x', start_date: day(1), end_date: day(1) })).error), 'guru biasa tidak bisa menambah agenda sekolah')
const calA = must(await sA.rpc('get_my_calendar', { p_from: day(-1), p_to: day(20) }))
check(calA.some((e) => e.title === `PTS ${tag}`) && calA.some((e) => e.title === 'Kerja bakti') && calA.some((e) => e.kind === 'assignment' && e.id === task.id), 'kalender siswa: agenda sekolah, agenda kelas, tenggat tugas')
check(!must(await sC.rpc('get_my_calendar', { p_from: day(-1), p_to: day(20) })).some((e) => e.title === 'Kerja bakti'), 'agenda kelas tidak muncul di kelas lain')

// ===== Badge =====
const lesson = must(await sA.from('lessons').select('id').eq('teaching_assignment_id', ta.id).limit(1).single())
must(await sA.rpc('mark_lesson_progress', { p_lesson_id: lesson.id, p_action: 'complete' }))
const badges = must(await sA.rpc('get_my_achievements'))
const first = badges.find((b) => b.code === 'langkah_pertama')
check(badges.length === 7 && first.earned && first.is_new, 'badge Langkah Pertama diraih setelah menyelesaikan pertemuan')
check(!must(await sA.rpc('get_my_achievements')).find((b) => b.code === 'langkah_pertama').is_new, 'badge yang sama tidak diberikan dua kali')
check((await notifs(sA)).some((n) => n.type === 'badge'), 'notifikasi badge baru')
check(Boolean((await guru.rpc('get_my_achievements')).error), 'halaman badge hanya untuk siswa')

// ===== Audit =====
must(await admin.from('announcements').delete().eq('title', `Terjadwal ${tag}`))
const { data: logs } = await admin.from('audit_logs').select('action').in('action', ['announcements.delete', 'discussion_replies.hide']).order('id', { ascending: false }).limit(10)
const acts = new Set(logs.map((l) => l.action))
check(acts.has('announcements.delete') && acts.has('discussion_replies.hide'), 'hapus pengumuman & moderasi forum tercatat di audit log')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
