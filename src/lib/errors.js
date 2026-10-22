const MESSAGES = [
  [/invalid login credentials/i, 'Username atau password salah.'],
  [/email not confirmed/i, 'Akun belum dikonfirmasi. Hubungi administrator.'],
  [/user is banned|banned/i, 'Akun Anda sedang dinonaktifkan. Hubungi administrator sekolah.'],
  [/too many requests|rate limit/i, 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'],
  [
    /failed to send a request to the edge function/i,
    'Server akun (Edge Function admin-users) tidak dapat dihubungi. Pastikan function sudah di-deploy dengan nama "admin-users" dan secret ALLOWED_ORIGINS sesuai alamat aplikasi.',
  ],
  [/failed to fetch|network/i, 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'],
  [/new password should be different/i, 'Password baru harus berbeda dari password lama.'],
  [/password should be at least/i, 'Password terlalu pendek.'],
  [/jwt expired|invalid jwt|session/i, 'Sesi Anda telah berakhir. Silakan login ulang.'],
  [/permission denied|42501/i, 'Anda tidak memiliki izin untuk tindakan ini.'],
]

/** Ubah error Supabase/jaringan menjadi pesan berbahasa Indonesia yang jelas. */
export function toMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!error) return fallback
  const raw = typeof error === 'string' ? error : error.message || error.error_description || ''
  const match = MESSAGES.find(([re]) => re.test(raw) || re.test(error.code ?? ''))
  return match ? match[1] : raw || fallback
}
