export const LOGIN_EMAIL_DOMAIN = import.meta.env.VITE_LOGIN_EMAIL_DOMAIN || 'lms.smpn1baradatu.sch.id'

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/

/** Username (NISN/NIP) → email login internal. Email asli dipakai apa adanya. */
export function loginIdToEmail(loginId) {
  const value = loginId.trim().toLowerCase()
  return value.includes('@') ? value : `${value}@${LOGIN_EMAIL_DOMAIN}`
}

export function isInternalEmail(email) {
  return email?.toLowerCase().endsWith(`@${LOGIN_EMAIL_DOMAIN}`)
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  teacher: 'Guru',
  student: 'Siswa',
}

/** Area (prefix URL) untuk setiap role. */
export const ROLE_AREAS = {
  admin: '/admin',
  teacher: '/guru',
  student: '/siswa',
}

const ROLE_PRIORITY = ['admin', 'teacher', 'student']

export function primaryRole(roles = []) {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null
}

export function roleFromPath(pathname) {
  return Object.entries(ROLE_AREAS).find(([, prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[0] ?? null
}
