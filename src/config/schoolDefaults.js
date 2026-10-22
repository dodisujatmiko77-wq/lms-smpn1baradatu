// Nilai cadangan bila pengaturan sekolah belum termuat dari database.
// Identitas resmi selalu dibaca dari tabel `school_settings`.
export const SCHOOL_DEFAULTS = {
  school_name: 'UPT SMP Negeri 1 Baradatu',
  short_name: 'SMPN 1 Baradatu',
  app_name: 'LMS Digital',
  tagline: 'Belajar di mana saja, kapan saja',
  address: 'Baradatu, Kabupaten Way Kanan, Lampung',
  logo_path: null,
  max_upload_mb: 5,
  max_image_upload_mb: 2,
  allowed_file_types: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp'],
}
