// Edge Function: manajemen akun oleh administrator.
// Aksi: create | bulk_create | reset_password | set_status | set_roles
// Semua aksi tercatat di audit_logs. Password tidak pernah disimpan di tabel aplikasi.
// Satu file mandiri agar bisa ditempel langsung di editor Dashboard Supabase.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------
// Header CORS. Batasi ALLOWED_ORIGINS di secrets Edge Function untuk produksi,
// contoh: "https://lms-smpn1baradatu.netlify.app,http://localhost:5173"
// Dinormalisasi (tanpa spasi, tanpa "/" di akhir, huruf kecil) agar salah ketik kecil tidak memblokir CORS.
const normalizeOrigin = (o: string) => o.trim().replace(/\/+$/, '').toLowerCase()
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(normalizeOrigin).filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = normalizeOrigin(req.headers.get('Origin') ?? '')
  const allowOrigin = allowed.length === 0 || allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------
// Verifikasi admin & audit
// ---------------------------------------------------------------------
type AdminContext = { admin: SupabaseClient; actorId: string }

/**
 * Memverifikasi bahwa pemanggil adalah administrator aktif.
 * Klien service_role HANYA dibuat di sini (server), tidak pernah di browser.
 */
async function requireAdmin(req: Request): Promise<AdminContext> {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Sesi tidak ditemukan. Silakan login ulang.')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) throw new HttpError(401, 'Sesi tidak valid. Silakan login ulang.')

  const actorId = userData.user.id
  const { data: profile } = await admin.from('profiles').select('is_active').eq('id', actorId).maybeSingle()
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', actorId)
    .eq('role', 'admin')
    .maybeSingle()

  if (!profile?.is_active || !role) throw new HttpError(403, 'Hanya administrator aktif yang dapat melakukan tindakan ini.')
  return { admin, actorId }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function audit(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await admin.from('audit_logs').insert({ actor_id: actorId, action, entity: 'auth.users', entity_id: entityId, details })
}

// ---------------------------------------------------------------------
// Aksi
// ---------------------------------------------------------------------

const ROLES = ['admin', 'teacher', 'student'] as const
type Role = (typeof ROLES)[number]

const LOGIN_DOMAIN = Deno.env.get('LOGIN_EMAIL_DOMAIN') ?? 'lms.smpn1baradatu.sch.id'
const USERNAME_RE = /^[a-z0-9._-]{3,40}$/
// Akun "dinonaktifkan" diblokir di Supabase Auth selama ±100 tahun.
const BAN_DURATION = '876000h'

function generatePassword(length = 10): string {
  // Tanpa karakter yang mirip (0/O, 1/l/I) agar mudah dibacakan ke siswa.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function parseRoles(value: unknown): Role[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, 'Minimal satu role harus dipilih.')
  const roles = [...new Set(value)]
  if (!roles.every((r) => (ROLES as readonly string[]).includes(r as string))) throw new HttpError(400, 'Role tidak dikenal.')
  return roles as Role[]
}

function validatePassword(pw: unknown): string | null {
  if (pw == null || pw === '') return null
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'Password minimal 8 karakter.')
  return pw
}

const BULK_LIMIT = 50
const NISN_RE = /^[0-9]{10}$/
const NIP_RE = /^[0-9]{18}$/
const NUPTK_RE = /^[0-9]{16}$/
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

const UNIQUE_MESSAGES: Record<string, string> = {
  students_nisn_key: 'NISN sudah terdaftar.',
  students_nis_key: 'NIS sudah terdaftar.',
  teachers_nip_key: 'NIP sudah terdaftar.',
  teachers_nuptk_key: 'NUPTK sudah terdaftar.',
  profiles_username_key: 'Username sudah digunakan.',
}

function dbMessage(error: { message: string; code?: string }): string {
  const key = Object.keys(UNIQUE_MESSAGES).find((k) => error.message.includes(k))
  if (key) return UNIQUE_MESSAGES[key]
  if (error.code === '23503') return 'Data rujukan (misalnya kelas) tidak ditemukan.'
  if (error.code === '23514') return 'Format data tidak valid.'
  return error.message
}

const text = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())

function optionalDate(v: unknown, label: string): string | null {
  const d = text(v)
  if (d && !DATE_RE.test(d)) throw new HttpError(400, `${label} harus berformat TTTT-BB-HH.`)
  return d
}

function gender(v: unknown, required: boolean): string | null {
  const g = text(v)?.toUpperCase() ?? null
  if (g == null && !required) return null
  if (g !== 'L' && g !== 'P') throw new HttpError(400, 'Jenis kelamin harus L atau P.')
  return g
}

type AccountResult = { user_id: string; username: string; password: string; details_saved: boolean }

/**
 * Membuat akun Auth + role + (opsional) data guru/siswa + penempatan kelas.
 * Bila salah satu langkah gagal, akun Auth dihapus kembali (kompensasi) agar
 * tidak ada akun "setengah jadi".
 */
async function createAccount(admin: SupabaseClient, input: Record<string, any>): Promise<AccountResult> {
  const username = String(input?.username ?? '').trim().toLowerCase()
  const fullName = String(input?.full_name ?? '').trim()
  const roles = parseRoles(input?.roles)
  const contactEmail = text(input?.contact_email)
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'Username 3–40 karakter: huruf kecil, angka, titik, garis bawah, atau strip.')
  }
  if (fullName.length < 2) throw new HttpError(400, 'Nama lengkap wajib diisi.')

  // Validasi data rinci sebelum akun dibuat.
  let teacherRow: Record<string, unknown> | null = null
  let studentRow: Record<string, unknown> | null = null
  let classId: string | null = null
  if (input.teacher) {
    const t = input.teacher
    const nip = text(t.nip)
    const nuptk = text(t.nuptk)
    if (nip && !NIP_RE.test(nip)) throw new HttpError(400, 'NIP harus 18 digit angka.')
    if (nuptk && !NUPTK_RE.test(nuptk)) throw new HttpError(400, 'NUPTK harus 16 digit angka.')
    teacherRow = {
      nip,
      nuptk,
      gender: gender(t.gender, false),
      birth_place: text(t.birth_place),
      birth_date: optionalDate(t.birth_date, 'Tanggal lahir'),
      employment_status: text(t.employment_status),
    }
  }
  if (input.student) {
    const st = input.student
    const nisn = text(st.nisn)
    if (!nisn || !NISN_RE.test(nisn)) throw new HttpError(400, 'NISN wajib 10 digit angka.')
    studentRow = {
      nisn,
      nis: text(st.nis),
      gender: gender(st.gender, true),
      birth_place: text(st.birth_place),
      birth_date: optionalDate(st.birth_date, 'Tanggal lahir'),
      religion: text(st.religion),
      address: text(st.address),
      parent_name: text(st.parent_name),
      parent_phone: text(st.parent_phone),
      entry_year: st.entry_year ? Number(st.entry_year) : null,
    }
    classId = text(st.class_id)
  }

  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  if (existing) throw new HttpError(409, `Username "${username}" sudah digunakan.`)

  const password = validatePassword(input.password) ?? generatePassword()
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${LOGIN_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName, contact_email: contactEmail },
    app_metadata: { roles, must_change_password: true },
  })
  if (error) throw new HttpError(400, `Gagal membuat akun: ${error.message}`)

  // GoTrue mengisi app_metadata SETELAH baris auth.users dibuat, sehingga trigger
  // profil tidak selalu melihat role. Role, flag, dan data rinci ditulis eksplisit.
  const userId = data.user.id
  try {
    const { error: roleErr } = await admin
      .from('user_roles')
      .upsert(roles.map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role', ignoreDuplicates: true })
    if (roleErr) throw new HttpError(500, `Gagal menyimpan role: ${roleErr.message}`)

    const profileUpdate: Record<string, unknown> = { must_change_password: true }
    if (input.phone) profileUpdate.phone = text(input.phone)
    const { error: flagErr } = await admin.from('profiles').update(profileUpdate).eq('id', userId)
    if (flagErr) throw new HttpError(500, flagErr.message)

    if (teacherRow) {
      const { error: tErr } = await admin.from('teachers').insert({ profile_id: userId, ...teacherRow })
      if (tErr) throw new HttpError(409, dbMessage(tErr))
    }
    if (studentRow) {
      const { data: st, error: sErr } = await admin.from('students').insert({ profile_id: userId, ...studentRow }).select('id').single()
      if (sErr) throw new HttpError(409, dbMessage(sErr))
      if (classId) {
        const { data: cls } = await admin.from('classes').select('academic_year_id').eq('id', classId).maybeSingle()
        if (!cls) throw new HttpError(400, 'Kelas tidak ditemukan.')
        const { error: eErr } = await admin
          .from('class_enrollments')
          .insert({ class_id: classId, student_id: st.id, academic_year_id: cls.academic_year_id })
        if (eErr) throw new HttpError(400, dbMessage(eErr))
      }
    }
  } catch (e) {
    await admin.auth.admin.deleteUser(userId)
    throw e
  }

  return { user_id: userId, username, password, details_saved: Boolean(teacherRow || studentRow) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Metode tidak didukung.' }, 405)

  try {
    const { admin, actorId } = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    switch (action) {
      case 'create': {
        const result = await createAccount(admin, body)
        await audit(admin, actorId, 'user.create', result.user_id, {
          username: result.username,
          full_name: body.full_name,
          roles: body.roles,
        })
        return json(req, result, 201)
      }

      case 'bulk_create': {
        // Impor massal (Excel). Diproses berurutan; tiap baris berhasil/gagal sendiri-sendiri.
        const rows = Array.isArray(body.rows) ? body.rows : []
        if (rows.length === 0) throw new HttpError(400, 'Tidak ada data untuk diimpor.')
        if (rows.length > BULK_LIMIT) throw new HttpError(400, `Maksimal ${BULK_LIMIT} baris per permintaan.`)

        const results = []
        for (const [index, row] of rows.entries()) {
          try {
            results.push({ index, ok: true, ...(await createAccount(admin, row)) })
          } catch (e) {
            results.push({ index, ok: false, username: row?.username ?? null, error: e instanceof HttpError ? e.message : 'Kesalahan server.' })
          }
        }
        const created = results.filter((r) => r.ok)
        await audit(admin, actorId, 'user.bulk_create', null, {
          total: rows.length,
          created: created.length,
          failed: rows.length - created.length,
          usernames: created.map((r) => r.username),
        })
        return json(req, { results })
      }

      case 'reset_password': {
        const userId = String(body.user_id ?? '')
        const password = validatePassword(body.password) ?? generatePassword()
        const { error } = await admin.auth.admin.updateUserById(userId, { password })
        if (error) throw new HttpError(400, `Gagal mereset password: ${error.message}`)
        await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
        // Keluarkan semua sesi lama pengguna tersebut.
        await admin.rpc('revoke_user_sessions', { p_user_id: userId })
        await audit(admin, actorId, 'user.reset_password', userId)
        return json(req, { user_id: userId, password })
      }

      case 'set_status': {
        const userId = String(body.user_id ?? '')
        const isActive = Boolean(body.is_active)
        if (userId === actorId && !isActive) throw new HttpError(400, 'Anda tidak dapat menonaktifkan akun sendiri.')
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? 'none' : BAN_DURATION })
        if (error) throw new HttpError(400, `Gagal mengubah status: ${error.message}`)
        const { error: pErr } = await admin.from('profiles').update({ is_active: isActive }).eq('id', userId)
        if (pErr) throw new HttpError(400, pErr.message)
        if (!isActive) await admin.rpc('revoke_user_sessions', { p_user_id: userId })
        await audit(admin, actorId, isActive ? 'user.activate' : 'user.deactivate', userId)
        return json(req, { user_id: userId, is_active: isActive })
      }

      case 'set_roles': {
        const userId = String(body.user_id ?? '')
        const roles = parseRoles(body.roles)
        if (userId === actorId && !roles.includes('admin')) {
          throw new HttpError(400, 'Anda tidak dapat menghapus role admin dari akun sendiri.')
        }
        const { error: delErr } = await admin.from('user_roles').delete().eq('user_id', userId).not('role', 'in', `(${roles.join(',')})`)
        if (delErr) throw new HttpError(400, delErr.message)
        const { error: insErr } = await admin
          .from('user_roles')
          .upsert(roles.map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role', ignoreDuplicates: true })
        if (insErr) throw new HttpError(400, insErr.message)
        await admin.auth.admin.updateUserById(userId, { app_metadata: { roles } })
        await audit(admin, actorId, 'user.set_roles', userId, { roles })
        return json(req, { user_id: userId, roles })
      }

      default:
        throw new HttpError(400, 'Aksi tidak dikenal.')
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const message = e instanceof HttpError ? e.message : 'Terjadi kesalahan pada server.'
    if (!(e instanceof HttpError)) console.error(e)
    return json(req, { error: message }, status)
  }
})
