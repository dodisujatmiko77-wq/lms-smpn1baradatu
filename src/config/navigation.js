import {
  Award, BarChart3, BookOpen, BookOpenCheck, CalendarDays, CalendarRange, ClipboardCheck, ClipboardList,
  Clock, FileQuestion, FolderOpen, GraduationCap, History, Home, LayoutDashboard, Library, Megaphone,
  MonitorCheck, School, Settings, ShieldCheck, Star, UserCog, Users, UsersRound,
} from 'lucide-react'

/**
 * Struktur menu per role. `stage` menandai tahap pengembangan ketika menu
 * tersebut mulai berfungsi; menu dengan stage > CURRENT_STAGE ditampilkan
 * sebagai "Segera hadir" (halaman informasi, bukan data palsu).
 */
export const CURRENT_STAGE = 4

export const NAVIGATION = {
  admin: [
    { items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, stage: 1, end: true }] },
    {
      label: 'Akademik',
      items: [
        { label: 'Tahun Pelajaran', to: '/admin/tahun-pelajaran', icon: CalendarRange, stage: 2 },
        { label: 'Kelas', to: '/admin/kelas', icon: School, stage: 2 },
        { label: 'Mata Pelajaran', to: '/admin/mapel', icon: Library, stage: 2 },
        { label: 'Penugasan Mengajar', to: '/admin/penugasan', icon: ClipboardList, stage: 2 },
        { label: 'Wali Kelas', to: '/admin/wali-kelas', icon: UsersRound, stage: 2 },
        { label: 'Jadwal Pelajaran', to: '/admin/jadwal', icon: Clock, stage: 2 },
      ],
    },
    {
      label: 'Pengguna',
      items: [
        { label: 'Akun Pengguna', to: '/admin/akun', icon: UserCog, stage: 1 },
        { label: 'Data Guru', to: '/admin/guru', icon: GraduationCap, stage: 2 },
        { label: 'Data Siswa', to: '/admin/siswa', icon: Users, stage: 2 },
      ],
    },
    {
      label: 'Pembelajaran',
      items: [
        { label: 'Monitoring Pembelajaran', to: '/admin/monitoring', icon: MonitorCheck, stage: 7 },
        { label: 'Monitoring Tugas', to: '/admin/monitoring-tugas', icon: ClipboardCheck, stage: 7 },
        { label: 'Manajemen File', to: '/admin/file', icon: FolderOpen, stage: 3 },
        { label: 'Pengumuman Sekolah', to: '/admin/pengumuman', icon: Megaphone, stage: 6 },
        { label: 'Laporan', to: '/admin/laporan', icon: BarChart3, stage: 7 },
      ],
    },
    {
      label: 'Sistem',
      items: [
        { label: 'Pengaturan Sekolah', to: '/admin/pengaturan', icon: Settings, stage: 1 },
        { label: 'Audit Log', to: '/admin/audit-log', icon: History, stage: 1 },
      ],
    },
  ],

  teacher: [
    { items: [{ label: 'Dashboard', to: '/guru', icon: LayoutDashboard, stage: 1, end: true }] },
    {
      label: 'Pembelajaran',
      items: [
        { label: 'Kelas Saya', to: '/guru/kelas', icon: BookOpen, stage: 3 },
        { label: 'Jadwal Mengajar', to: '/guru/jadwal', icon: Clock, stage: 2 },
        { label: 'Bank Soal', to: '/guru/bank-soal', icon: FileQuestion, stage: 5 },
        { label: 'Pemeriksaan', to: '/guru/pemeriksaan', icon: ClipboardCheck, stage: 4 },
      ],
    },
    {
      label: 'Lainnya',
      items: [
        { label: 'Kalender', to: '/guru/kalender', icon: CalendarDays, stage: 6 },
        { label: 'Laporan Pembelajaran', to: '/guru/laporan', icon: BarChart3, stage: 7 },
      ],
    },
  ],

  // Menu tambahan untuk guru yang ditetapkan sebagai wali kelas.
  guardian: [
    {
      label: 'Wali Kelas',
      items: [
        { label: 'Kelas Binaan', to: '/guru/wali-kelas', icon: ShieldCheck, stage: 7 },
        { label: 'Monitoring Tugas', to: '/guru/wali-kelas/tugas', icon: ClipboardList, stage: 7 },
        { label: 'Perlu Tindak Lanjut', to: '/guru/wali-kelas/tindak-lanjut', icon: Star, stage: 7 },
      ],
    },
  ],

  student: [
    { items: [{ label: 'Beranda', to: '/siswa', icon: Home, stage: 1, end: true }] },
    {
      label: 'Belajar',
      items: [
        { label: 'Mata Pelajaran', to: '/siswa/mapel', icon: BookOpen, stage: 3 },
        { label: 'Tugas', to: '/siswa/tugas', icon: ClipboardList, stage: 4 },
        { label: 'Kuis & Ujian', to: '/siswa/kuis', icon: BookOpenCheck, stage: 5 },
        { label: 'Jadwal', to: '/siswa/jadwal', icon: Clock, stage: 2 },
        { label: 'Kalender', to: '/siswa/kalender', icon: CalendarDays, stage: 6 },
      ],
    },
    {
      label: 'Pencapaian',
      items: [
        { label: 'Nilai & Umpan Balik', to: '/siswa/nilai', icon: Star, stage: 4 },
        { label: 'Badge Saya', to: '/siswa/pencapaian', icon: Award, stage: 6 },
      ],
    },
  ],
}

/** Navigasi bawah (HP) untuk siswa. */
export const STUDENT_BOTTOM_NAV = [
  { label: 'Beranda', to: '/siswa', icon: Home, end: true },
  { label: 'Mapel', to: '/siswa/mapel', icon: BookOpen },
  { label: 'Tugas', to: '/siswa/tugas', icon: ClipboardList },
  { label: 'Kalender', to: '/siswa/kalender', icon: CalendarDays },
  { label: 'Profil', to: '/profil', icon: UserCog },
]

export function navigationFor(role, { isGuardian = false } = {}) {
  const groups = NAVIGATION[role] ?? []
  return role === 'teacher' && isGuardian ? [...groups, ...NAVIGATION.guardian] : groups
}

/** Semua item menu (rata) — dipakai untuk membuat rute "Segera hadir" & pencarian menu. */
export function allNavItems() {
  return Object.entries(NAVIGATION).flatMap(([role, groups]) =>
    groups.flatMap((g) => g.items.map((item) => ({ ...item, role: role === 'guardian' ? 'teacher' : role }))),
  )
}

export const STAGE_NAMES = {
  1: 'Fondasi',
  2: 'Data Master',
  3: 'Pembelajaran',
  4: 'Tugas',
  5: 'Kuis & CBT',
  6: 'Interaksi',
  7: 'Monitoring & Laporan',
  8: 'Penyempurnaan',
}
