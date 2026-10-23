// Uji ujung-ke-ujung foto profil (bucket privat `avatars`) — JANGAN ke produksi.
// SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node supabase/tests/e2e_foto_profil.mjs
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.ANON_KEY
const DOMAIN = process.env.LOGIN_EMAIL_DOMAIN ?? 'lms.smpn1baradatu.sch.id'
const BUCKET = 'avatars'
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
// WebP 1×1 piksel
const webp = () => new Blob([Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64')], { type: 'image/webp' })

const admin = await login(process.env.ADMIN_LOGIN, process.env.ADMIN_PASSWORD)
const tag = rnd(4)
const nis = rnd(10), tUser = `gurufoto${tag}`
const { data: bulk } = await admin.functions.invoke('admin-users', {
  body: { action: 'bulk_create', rows: [{ username: tUser, full_name: 'Guru Foto', roles: ['teacher'], teacher: {} }, { username: nis, full_name: 'Siswa Foto', roles: ['student'], student: { nisn: nis, gender: 'L' } }] },
})
const pw = Object.fromEntries(bulk.results.map((r) => [r.username, r.password]))
const siswa = await login(nis, pw[nis])
const guru = await login(tUser, pw[tUser])
const sid = (await siswa.auth.getUser()).data.user.id
const gid = (await guru.auth.getUser()).data.user.id

// ===== Pemilik =====
const own = `${sid}/foto-${tag}.webp`
check(!(await siswa.storage.from(BUCKET).upload(own, webp(), { contentType: 'image/webp' })).error, 'siswa mengunggah foto ke foldernya sendiri')
check(!(await siswa.from('profiles').update({ avatar_path: own }).eq('id', sid)).error, 'siswa menyimpan foto di profilnya')
check(must(await siswa.rpc('get_my_context')).avatar_path === own, 'foto tercatat di konteks pengguna')
check(!(await siswa.storage.from(BUCKET).createSignedUrl(own, 60)).error, 'siswa membuka fotonya sendiri')

// ===== Batasan =====
const gPath = `${gid}/foto-${tag}.webp`
check(!(await guru.storage.from(BUCKET).upload(gPath, webp(), { contentType: 'image/webp' })).error, 'guru mengunggah fotonya')
check(Boolean((await siswa.storage.from(BUCKET).upload(`${gid}/sisipan-${tag}.webp`, webp(), { contentType: 'image/webp' })).error), 'siswa tidak bisa mengunggah ke folder guru')
check(Boolean((await siswa.storage.from(BUCKET).createSignedUrl(gPath, 60)).error), 'siswa tidak bisa membuka foto guru')
await siswa.storage.from(BUCKET).remove([gPath])
check(!(await guru.storage.from(BUCKET).createSignedUrl(gPath, 60)).error, 'siswa tidak bisa menghapus foto guru')
check(Boolean((await siswa.from('profiles').update({ avatar_path: gPath }).eq('id', sid)).error), 'profil tidak boleh menunjuk foto milik orang lain')
check(Boolean((await siswa.from('profiles').update({ avatar_path: `${sid}/../x.webp` }).eq('id', sid)).error), 'path foto dengan karakter berbahaya ditolak')
check(Boolean((await siswa.from('profiles').update({ full_name: 'Ganti Nama' }).eq('id', sid)).error), 'siswa tetap tidak bisa mengubah namanya sendiri')
check(Boolean((await siswa.storage.from(BUCKET).upload(`${sid}/catatan-${tag}.txt`, new Blob(['halo'], { type: 'text/plain' }), { contentType: 'text/plain' })).error), 'berkas selain gambar ditolak')
check(Boolean((await siswa.storage.from(BUCKET).upload(`${sid}/besar-${tag}.webp`, new Blob([new Uint8Array(1100000)], { type: 'image/webp' }), { contentType: 'image/webp' })).error), 'foto lebih dari 1 MB ditolak')
check(Boolean((await client().storage.from(BUCKET).createSignedUrl(own, 60)).error), 'pengguna tanpa login tidak bisa membuka foto')
check(!(await admin.storage.from(BUCKET).createSignedUrl(own, 60)).error, 'admin dapat membuka foto pengguna')

// ===== Hapus =====
check(!(await siswa.from('profiles').update({ avatar_path: null }).eq('id', sid)).error, 'siswa menghapus foto dari profil')
check(must(await siswa.storage.from(BUCKET).remove([own])).length === 1, 'berkas foto lama terhapus dari Storage')

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji lolos')
process.exit(failed ? 1 : 0)
