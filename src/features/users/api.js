import { supabase } from '@/lib/supabase'

export const USERS_KEY = ['admin', 'users']

function sanitizeSearch(term) {
  // Karakter berikut punya arti khusus pada filter PostgREST `or=(...)`.
  return term.replace(/[,()*%"\\]/g, ' ').trim()
}

/** Daftar akun (khusus admin — dibatasi RLS) dengan pencarian, filter, dan pagination. */
export async function listUsers({ page = 1, pageSize = 20, search = '', role = 'all', status = 'all' }) {
  // Embed kedua (alias role_filter) dipakai untuk menyaring, agar badge tetap menampilkan semua role.
  const roleJoin = role === 'all' ? 'user_roles(role)' : 'user_roles(role), role_filter:user_roles!inner(role)'
  let query = supabase
    .from('profiles')
    .select(`id, username, full_name, contact_email, phone, is_active, must_change_password, last_login_at, created_at, ${roleJoin}`, {
      count: 'exact',
    })
    .order('full_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (role !== 'all') query = query.eq('role_filter.role', role)
  if (status !== 'all') query = query.eq('is_active', status === 'active')
  const term = sanitizeSearch(search)
  if (term) query = query.or(`full_name.ilike."*${term}*",username.ilike."*${term}*"`)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

/** Memanggil Edge Function `admin-users` (service_role hanya ada di server). */
export async function adminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let message = error.message
    try {
      const payload = await error.context?.json()
      if (payload?.error) message = payload.error
    } catch {
      /* respons bukan JSON */
    }
    throw new Error(message)
  }
  return data
}

export async function updateProfileAsAdmin({ userId, fullName, contactEmail, phone }) {
  const { error } = await supabase.rpc('admin_update_profile', {
    p_user_id: userId,
    p_full_name: fullName,
    p_contact_email: contactEmail || null,
    p_phone: phone || null,
  })
  if (error) throw error
}
