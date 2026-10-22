// Pelanggaran constraint database → pesan yang mudah dipahami.
const CONSTRAINT_MESSAGES = {
  academic_years_name_key: 'Tahun pelajaran tersebut sudah ada.',
  academic_years_name_format: 'Format tahun pelajaran harus TTTT/TTTT, contoh 2026/2027.',
  classes_unique_name: 'Nama kelas sudah dipakai pada tahun pelajaran ini.',
  subjects_code_key: 'Kode mata pelajaran sudah digunakan.',
  subjects_code_format: 'Kode mapel 2–12 karakter: huruf kapital, angka, atau strip.',
  teaching_assignments_unique: 'Mapel ini sudah memiliki guru di kelas tersebut pada semester ini.',
  class_guardians_unique: 'Kelas ini sudah memiliki wali kelas pada semester ini.',
  class_enrollments_one_per_year: 'Siswa sudah ditempatkan di kelas lain pada tahun pelajaran ini.',
  students_nisn_key: 'NISN sudah terdaftar.',
  students_nis_key: 'NIS sudah terdaftar.',
  teachers_nip_key: 'NIP sudah terdaftar.',
  teachers_nuptk_key: 'NUPTK sudah terdaftar.',
  schedules_time: 'Jam selesai harus setelah jam mulai.',
  quiz_question_items_question_id_fkey: 'Soal masih dipakai di kuis. Keluarkan dulu dari kuis sebelum menghapusnya.',
  quiz_question_items_unique: 'Soal tersebut sudah ada di kuis ini.',
  question_banks_subject_id_fkey: 'Mata pelajaran masih dipakai oleh bank soal.',
  quizzes_window: 'Waktu tutup harus setelah waktu buka.',
  quizzes_duration: 'Durasi pengerjaan 1–300 menit.',
  quizzes_attempts: 'Batas percobaan 1–10 kali.',
  quiz_questions_tf_key: 'Pilih kunci jawaban Benar atau Salah.',
  quiz_questions_short_key: 'Soal isian wajib memiliki kunci jawaban.',
  quiz_questions_points: 'Skor soal harus lebih dari 0 dan maksimal 100.',
}

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
  [/permission denied|42501|row-level security/i, 'Anda tidak memiliki izin untuk tindakan ini.'],
  [/violates check constraint/i, 'Format data tidak valid. Periksa kembali isian Anda.'],
  [/duplicate key/i, 'Data yang sama sudah ada.'],
]

/** Ubah error Supabase/jaringan menjadi pesan berbahasa Indonesia yang jelas. */
export function toMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!error) return fallback
  const raw = typeof error === 'string' ? error : error.message || error.error_description || ''
  const constraint = Object.keys(CONSTRAINT_MESSAGES).find((k) => raw.includes(k))
  if (constraint) return CONSTRAINT_MESSAGES[constraint]
  if (error.code === '23503') return 'Data tidak dapat dihapus/diubah karena masih digunakan oleh data lain (misalnya siswa, penugasan, atau jadwal).'
  // Pesan dari trigger/fungsi database sudah berbahasa Indonesia.
  if (['23514', '23P01', '42501', 'P0002', '22023'].includes(error.code) && raw && !/permission denied|row-level security|violates/i.test(raw)) return raw
  const match = MESSAGES.find(([re]) => re.test(raw) || re.test(error.code ?? ''))
  return match ? match[1] : raw || fallback
}
