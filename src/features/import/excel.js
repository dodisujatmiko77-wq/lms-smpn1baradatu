import { EMPLOYMENT_STATUS, normalizeClassName } from '@/lib/academic'

// ExcelJS cukup besar, jadi hanya dimuat saat fitur impor/ekspor dipakai.
async function loadExcel() {
  const mod = await import('exceljs')
  return mod.default ?? mod
}

export const COLUMNS = {
  student: [
    { key: 'nisn', header: 'NISN', required: true, width: 14, note: '10 digit angka' },
    { key: 'nis', header: 'NIS', width: 12 },
    { key: 'full_name', header: 'Nama Lengkap', required: true, width: 32 },
    { key: 'gender', header: 'L/P', required: true, width: 6, note: 'L atau P' },
    { key: 'birth_place', header: 'Tempat Lahir', width: 16 },
    { key: 'birth_date', header: 'Tanggal Lahir', width: 14, note: 'TTTT-BB-HH, contoh 2013-05-21' },
    { key: 'religion', header: 'Agama', width: 12 },
    { key: 'class_name', header: 'Kelas', width: 10, note: 'Nama kelas TP aktif, contoh VII-A (boleh kosong)' },
    { key: 'parent_name', header: 'Nama Orang Tua/Wali', width: 26 },
    { key: 'parent_phone', header: 'No. HP Orang Tua', width: 16 },
    { key: 'address', header: 'Alamat', width: 32 },
  ],
  teacher: [
    { key: 'nip', header: 'NIP', width: 22, note: '18 digit (kosongkan bila tidak ada)' },
    { key: 'nuptk', header: 'NUPTK', width: 20, note: '16 digit (opsional)' },
    { key: 'full_name', header: 'Nama Lengkap', required: true, width: 32, note: 'Termasuk gelar, contoh: Siti Aminah, S.Pd.' },
    { key: 'gender', header: 'L/P', width: 6, note: 'L atau P' },
    { key: 'username', header: 'Username', width: 18, note: 'Wajib bila NIP & NUPTK kosong' },
    { key: 'employment_status', header: 'Status Kepegawaian', width: 18, note: EMPLOYMENT_STATUS.join(' / ') },
    { key: 'phone', header: 'No. HP', width: 16 },
    { key: 'birth_place', header: 'Tempat Lahir', width: 16 },
    { key: 'birth_date', header: 'Tanggal Lahir', width: 14, note: 'TTTT-BB-HH' },
  ],
}

function download(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
  row.alignment = { vertical: 'middle' }
  row.height = 22
}

/** Template impor: sheet "Data" (kolom berformat teks) + sheet "Petunjuk". */
export async function downloadTemplate(type) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const cols = COLUMNS[type]
  const ws = wb.addWorksheet('Data')
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: { numFmt: '@' } }))
  styleHeader(ws.getRow(1))
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const help = wb.addWorksheet('Petunjuk')
  help.columns = [{ width: 24 }, { width: 10 }, { width: 60 }]
  help.addRow(['Kolom', 'Wajib', 'Keterangan'])
  styleHeader(help.getRow(1))
  cols.forEach((c) => help.addRow([c.header, c.required ? 'Ya' : '', c.note ?? '']))
  help.addRow([])
  help.addRow(['Catatan', '', 'Isi data mulai baris ke-2 sheet "Data". Jangan mengubah judul kolom.'])
  help.addRow(['', '', 'Semua kolom berformat teks agar angka 0 di depan NISN/NIP tidak hilang.'])
  help.addRow(['', '', 'Password sementara dibuat otomatis dan dapat diunduh setelah impor selesai.'])

  download(await wb.xlsx.writeBuffer(), type === 'student' ? 'template-impor-siswa.xlsx' : 'template-impor-guru.xlsx')
}

function cellText(cell) {
  const v = cell.value
  if (v == null) return { text: '', isNumber: false }
  if (v instanceof Date) {
    const iso = `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
    return { text: iso, isNumber: false }
  }
  if (typeof v === 'number') return { text: String(v), isNumber: true }
  if (typeof v === 'object') {
    if (v.richText) return { text: v.richText.map((r) => r.text).join('').trim(), isNumber: false }
    if (v.text != null) return { text: String(v.text).trim(), isNumber: false }
    if (v.result != null) return { text: String(v.result).trim(), isNumber: typeof v.result === 'number' }
  }
  return { text: String(v).trim(), isNumber: false }
}

/** Membaca file .xlsx → [{ rowNumber, values: {key: text}, numeric: Set<key> }] */
export async function readSheet(file, type) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet('Data') ?? wb.worksheets[0]
  if (!ws) throw new Error('File tidak berisi sheet data.')

  const cols = COLUMNS[type]
  const headerMap = {}
  ws.getRow(1).eachCell((cell, col) => {
    const h = cellText(cell).text.toLowerCase()
    const match = cols.find((c) => h === c.header.toLowerCase() || h.startsWith(c.header.toLowerCase()))
    if (match) headerMap[col] = match.key
  })
  const missing = cols.filter((c) => c.required && !Object.values(headerMap).includes(c.key))
  if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.map((c) => c.header).join(', ')}. Gunakan template yang disediakan.`)

  const rows = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values = {}
    const numeric = new Set()
    Object.entries(headerMap).forEach(([col, key]) => {
      const { text, isNumber } = cellText(row.getCell(Number(col)))
      values[key] = text
      if (isNumber) numeric.add(key)
    })
    if (Object.values(values).some(Boolean)) rows.push({ rowNumber, values, numeric })
  })
  return rows
}

function normalizeDate(s) {
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return 'INVALID'
}

function normalizeGender(s) {
  const g = (s ?? '').trim().toUpperCase()
  if (['L', 'LAKI-LAKI', 'LAKI LAKI', 'LAKI'].includes(g)) return 'L'
  if (['P', 'PEREMPUAN', 'WANITA'].includes(g)) return 'P'
  return g ? 'INVALID' : null
}

/**
 * Validasi baris & ubah ke payload Edge Function.
 * classes: daftar kelas TP aktif (untuk mencocokkan kolom Kelas).
 */
export function buildPayloads(rows, type, { classes = [] } = {}) {
  const classMap = new Map(classes.map((c) => [normalizeClassName(c.name), c]))
  const seen = new Map()
  return rows.map(({ rowNumber, values: v, numeric }) => {
    const errors = []
    const fullName = v.full_name?.trim()
    if (!fullName || fullName.length < 2) errors.push('Nama lengkap wajib diisi.')
    const gender = normalizeGender(v.gender)
    if (gender === 'INVALID') errors.push('L/P harus L atau P.')
    const birthDate = normalizeDate(v.birth_date)
    if (birthDate === 'INVALID') errors.push('Tanggal lahir tidak dikenali (gunakan TTTT-BB-HH).')

    let payload
    let display
    if (type === 'student') {
      let nisn = (v.nisn ?? '').replace(/\s/g, '')
      if (numeric.has('nisn') && /^\d+$/.test(nisn) && nisn.length < 10) nisn = nisn.padStart(10, '0')
      if (!/^\d{10}$/.test(nisn)) errors.push('NISN harus 10 digit angka.')
      if (!gender) errors.push('L/P wajib diisi.')
      let cls = null
      if (v.class_name) {
        cls = classMap.get(normalizeClassName(v.class_name))
        if (!cls) errors.push(`Kelas "${v.class_name}" tidak ada di tahun pelajaran aktif.`)
      }
      if (nisn && seen.has(nisn)) errors.push(`NISN ganda dengan baris ${seen.get(nisn)}.`)
      else if (nisn) seen.set(nisn, rowNumber)
      payload = {
        username: nisn,
        full_name: fullName,
        roles: ['student'],
        student: {
          nisn,
          nis: v.nis || null,
          gender,
          birth_place: v.birth_place || null,
          birth_date: birthDate === 'INVALID' ? null : birthDate,
          religion: v.religion || null,
          address: v.address || null,
          parent_name: v.parent_name || null,
          parent_phone: v.parent_phone || null,
          class_id: cls?.id ?? null,
        },
      }
      display = { id: nisn, name: fullName, extra: cls?.name ?? '' }
    } else {
      const nip = (v.nip ?? '').replace(/\s/g, '')
      const nuptk = (v.nuptk ?? '').replace(/\s/g, '')
      if (numeric.has('nip') && nip) errors.push('NIP terbaca sebagai angka sehingga digit bisa berubah — format kolom NIP sebagai Teks.')
      else if (nip && !/^\d{18}$/.test(nip)) errors.push('NIP harus 18 digit angka.')
      if (numeric.has('nuptk') && nuptk) errors.push('NUPTK terbaca sebagai angka — format kolom NUPTK sebagai Teks.')
      else if (nuptk && !/^\d{16}$/.test(nuptk)) errors.push('NUPTK harus 16 digit angka.')
      const username = (nip || nuptk || v.username || '').trim().toLowerCase()
      if (!username) errors.push('Isi NIP, NUPTK, atau Username.')
      else if (!/^[a-z0-9._-]{3,40}$/.test(username)) errors.push('Username hanya huruf kecil, angka, titik, garis bawah, atau strip (3–40).')
      if (username && seen.has(username)) errors.push(`Username/NIP ganda dengan baris ${seen.get(username)}.`)
      else if (username) seen.set(username, rowNumber)
      // Samakan penulisan dengan pilihan baku, mis. "pppk  paruh waktu" → "PPPK Paruh Waktu".
      const statusRaw = (v.employment_status ?? '').trim().replace(/\s+/g, ' ')
      const status = EMPLOYMENT_STATUS.find((s) => s.toLowerCase() === statusRaw.toLowerCase()) ?? statusRaw
      payload = {
        username,
        full_name: fullName,
        roles: ['teacher'],
        phone: v.phone || null,
        teacher: {
          nip: nip || null,
          nuptk: nuptk || null,
          gender,
          birth_place: v.birth_place || null,
          birth_date: birthDate === 'INVALID' ? null : birthDate,
          employment_status: status || null,
        },
      }
      display = { id: username, name: fullName, extra: status }
    }
    return { rowNumber, errors, payload, ...display }
  })
}

/** Daftar akun hasil impor (username + password sementara) untuk dibagikan. */
export async function downloadCredentials(results, type) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Akun')
  ws.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Nama', key: 'name', width: 32 },
    { header: type === 'student' ? 'Username (NISN)' : 'Username', key: 'username', width: 22, style: { numFmt: '@' } },
    { header: 'Password Sementara', key: 'password', width: 20 },
    { header: type === 'student' ? 'Kelas' : 'Keterangan', key: 'extra', width: 14 },
  ]
  styleHeader(ws.getRow(1))
  results.filter((r) => r.ok).forEach((r, i) => ws.addRow({ no: i + 1, name: r.name, username: r.username, password: r.password, extra: r.extra }))
  ws.addRow([])
  ws.addRow(['', 'Wajib ganti password saat login pertama. Simpan daftar ini dengan aman.'])
  const date = new Date().toISOString().slice(0, 10)
  download(await wb.xlsx.writeBuffer(), `akun-${type === 'student' ? 'siswa' : 'guru'}-${date}.xlsx`)
}
