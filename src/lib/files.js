const EXT_INFO = {
  pdf: { type: 'pdf', mime: 'application/pdf' },
  jpg: { type: 'image', mime: 'image/jpeg' },
  jpeg: { type: 'image', mime: 'image/jpeg' },
  png: { type: 'image', mime: 'image/png' },
  webp: { type: 'image', mime: 'image/webp' },
  gif: { type: 'image', mime: 'image/gif' },
  ppt: { type: 'presentation', mime: 'application/vnd.ms-powerpoint' },
  pptx: { type: 'presentation', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  odp: { type: 'presentation', mime: 'application/vnd.oasis.opendocument.presentation' },
  doc: { type: 'document', mime: 'application/msword' },
  docx: { type: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  odt: { type: 'document', mime: 'application/vnd.oasis.opendocument.text' },
  xls: { type: 'file', mime: 'application/vnd.ms-excel' },
  xlsx: { type: 'file', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ods: { type: 'file', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
}

export const fileExt = (name = '') => name.split('.').pop()?.toLowerCase() ?? ''

/** Info jenis materi & MIME berdasarkan ekstensi (null bila tidak didukung). */
export const fileInfo = (name) => EXT_INFO[fileExt(name)] ?? null

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

/** Nama berkas aman untuk path storage (huruf, angka, titik, strip). */
export function safeFileName(name) {
  const ext = fileExt(name)
  const base = name.slice(0, name.length - ext.length - 1)
  const clean = base.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'berkas'
  return `${clean}.${ext}`
}

/**
 * Kompres gambar di browser (maks. 1600px, WebP) agar hemat kuota penyimpanan & kuota internet siswa.
 * GIF tidak diubah (animasi akan hilang).
 */
export async function compressImage(file, { maxSize = 1600, quality = 0.82 } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], name, { type: 'image/webp' })
  } catch {
    return file
  }
}

/** ID acak pendek; tidak bergantung pada crypto.randomUUID (butuh https). */
export const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
