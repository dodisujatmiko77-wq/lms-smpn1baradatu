// Edge Function: manajemen akun oleh administrator.
// Aksi: create | reset_password | set_status | set_roles
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Metode tidak didukung.' }, 405)

  try {
    const { admin, actorId } = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    switch (action) {
      case 'create': {
        const username = String(body.username ?? '').trim().toLowerCase()
        const fullName = String(body.full_name ?? '').trim()
        const roles = parseRoles(body.roles)
        const contactEmail = body.contact_email ? String(body.contact_email).trim() : null
        if (!USERNAME_RE.test(username)) {
          throw new HttpError(400, 'Username 3–40 karakter: huruf kecil, angka, titik, garis bawah, atau strip.')
        }
        if (fullName.length < 2) throw new HttpError(400, 'Nama lengkap wajib diisi.')

        const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
        if (existing) throw new HttpError(409, `Username "${username}" sudah digunakan.`)

        const password = validatePassword(body.password) ?? generatePassword()
        const { data, error } = await admin.auth.admin.createUser({
          email: `${username}@${LOGIN_DOMAIN}`,
          password,
          email_confirm: true,
          user_metadata: { username, full_name: fullName, contact_email: contactEmail },
          app_metadata: { roles, must_change_password: true },
        })
        if (error) throw new HttpError(400, `Gagal membuat akun: ${error.message}`)

        // GoTrue mengisi app_metadata SETELAH baris auth.users dibuat, sehingga trigger
        // profil tidak selalu melihat role. Role & flag ditulis eksplisit di sini;
        // bila gagal, akun Auth dihapus lagi agar data tetap konsisten.
        const userId = data.user.id
        const { error: roleErr } = await admin
          .from('user_roles')
          .upsert(roles.map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role', ignoreDuplicates: true })
        const { error: flagErr } = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
        if (roleErr || flagErr) {
          await admin.auth.admin.deleteUser(userId)
          throw new HttpError(500, `Gagal menyimpan role akun: ${(roleErr ?? flagErr)!.message}`)
        }

        await audit(admin, actorId, 'user.create', userId, { username, full_name: fullName, roles })
        return json(req, { user_id: userId, username, password }, 201)
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
