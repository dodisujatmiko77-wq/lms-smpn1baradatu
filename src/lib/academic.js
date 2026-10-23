export const DAYS = [
  { value: 1, label: 'Senin', short: 'Sen' },
  { value: 2, label: 'Selasa', short: 'Sel' },
  { value: 3, label: 'Rabu', short: 'Rab' },
  { value: 4, label: 'Kamis', short: 'Kam' },
  { value: 5, label: 'Jumat', short: 'Jum' },
  { value: 6, label: 'Sabtu', short: 'Sab' },
]

export const GRADES = [
  { value: 7, label: 'Kelas VII', roman: 'VII' },
  { value: 8, label: 'Kelas VIII', roman: 'VIII' },
  { value: 9, label: 'Kelas IX', roman: 'IX' },
]

export const STUDENT_STATUS = {
  active: { label: 'Aktif', tone: 'green' },
  graduated: { label: 'Lulus', tone: 'blue' },
  moved: { label: 'Pindah', tone: 'orange' },
  dropped: { label: 'Keluar', tone: 'red' },
}

export const EMPLOYMENT_STATUS = ['PNS', 'PPPK', 'PPPK Paruh Waktu', 'Honorer', 'GTT', 'GTY']

export const RELIGIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu']

export const semesterLabel = (n) => (n === 1 ? 'Ganjil' : n === 2 ? 'Genap' : '—')

export const gradeRoman = (g) => GRADES.find((x) => x.value === g)?.roman ?? String(g)

export const dayLabel = (d) => DAYS.find((x) => x.value === d)?.label ?? '—'

/** Hari ini sebagai 1..6 (Senin..Sabtu), atau null untuk Minggu. */
export function todayDow(date = new Date()) {
  const d = date.getDay()
  return d === 0 ? null : d
}

export const hhmm = (t) => (t ? t.slice(0, 5) : '')

/** "7A", "VII A", "vii-a" → "VIIA" untuk mencocokkan nama kelas dari Excel. */
export function normalizeClassName(name) {
  const s = String(name ?? '').toUpperCase().replace(/[\s._-]+/g, '')
  return s.replace(/^(7|8|9)(?=[A-Z])/, (m) => ({ 7: 'VII', 8: 'VIII', 9: 'IX' })[m])
}

/** Usulan nama tahun pelajaran berikutnya berdasarkan tanggal (TP mulai Juli). */
export function suggestAcademicYear(date = new Date()) {
  const y = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
  return { name: `${y}/${y + 1}`, start: `${y}-07-13`, end: `${y + 1}-06-30` }
}
