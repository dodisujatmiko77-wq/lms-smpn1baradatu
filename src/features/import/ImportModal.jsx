import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Modal } from '@/components/ui'
import { adminUsers } from '@/features/users/api'
import { toMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { buildPayloads, downloadCredentials, downloadTemplate, readSheet } from './excel'

const CHUNK = 25

/** Impor akun guru/siswa dari Excel: unggah → pratinjau & validasi → proses bertahap → unduh daftar akun. */
export function ImportModal({ open, type, classes, onClose, onDone }) {
  const [step, setStep] = useState('upload')
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState([])
  const [reading, setReading] = useState(false)
  const fileRef = useRef(null)
  const label = type === 'student' ? 'siswa' : 'guru'

  const reset = () => {
    setStep('upload')
    setRows([])
    setResults([])
    setProgress(0)
  }

  const close = () => {
    if (step === 'running') return
    if (step === 'done') onDone?.()
    reset()
    onClose()
  }

  const onFile = async (file) => {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) return toast.error('Gunakan file Excel berformat .xlsx.')
    setReading(true)
    try {
      const raw = await readSheet(file, type)
      if (raw.length === 0) throw new Error('Tidak ada baris data pada file.')
      if (raw.length > 1500) throw new Error('Maksimal 1.500 baris per impor.')
      setRows(buildPayloads(raw, type, { classes }))
      setStep('preview')
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const valid = rows.filter((r) => r.errors.length === 0)
  const invalid = rows.length - valid.length

  const run = async () => {
    setStep('running')
    const out = []
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK)
      try {
        const res = await adminUsers({ action: 'bulk_create', rows: chunk.map((r) => r.payload) })
        res.results.forEach((r) => out.push({ ...chunk[r.index], ...r }))
      } catch (e) {
        chunk.forEach((r) => out.push({ ...r, ok: false, error: toMessage(e) }))
      }
      setProgress(Math.min(valid.length, i + CHUNK))
    }
    setResults(out)
    setStep('done')
    const ok = out.filter((r) => r.ok).length
    if (ok) toast.success(`${ok} akun ${label} berhasil dibuat.`)
  }

  const created = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      dismissible={step !== 'running'}
      title={`Impor ${label} dari Excel`}
      description="Setiap baris menjadi akun login dengan password sementara."
      footer={
        step === 'preview' ? (
          <>
            <Button variant="outline" onClick={reset}>Pilih file lain</Button>
            <Button icon={Upload} onClick={run} disabled={valid.length === 0}>Impor {valid.length} {label}</Button>
          </>
        ) : step === 'done' ? (
          <>
            {created.length > 0 && <Button variant="outline" icon={Download} onClick={() => downloadCredentials(results, type)}>Unduh daftar akun</Button>}
            <Button onClick={close}>Selesai</Button>
          </>
        ) : null
      }
    >
      {step === 'upload' && (
        <div className="space-y-4">
          <ol className="space-y-2 text-sm text-slate-600">
            <li>1. Unduh template, isi data mulai baris ke-2 (jangan ubah judul kolom).</li>
            <li>2. Unggah kembali file tersebut. Data akan diperiksa sebelum diimpor.</li>
            {type === 'student' && <li>3. Isi kolom Kelas (misalnya VII-A) agar siswa langsung ditempatkan di kelas tahun pelajaran aktif.</li>}
          </ol>
          <Button variant="outline" icon={Download} onClick={() => downloadTemplate(type)}>Unduh template {label}</Button>
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-primary-400 hover:bg-primary-50/40',
              reading && 'pointer-events-none opacity-60',
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFile(e.dataTransfer.files?.[0])
            }}
          >
            <FileSpreadsheet className="h-10 w-10 text-success-600" />
            <span className="text-sm font-medium text-slate-800">{reading ? 'Membaca file…' : 'Klik atau seret file .xlsx ke sini'}</span>
            <span className="text-xs text-slate-500">Maksimal 1.500 baris</span>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> {valid.length} siap diimpor</Badge>
            {invalid > 0 && <Badge tone="red"><XCircle className="h-3 w-3" /> {invalid} bermasalah (dilewati)</Badge>}
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">Baris</th>
                  <th className="px-3 py-2">{type === 'student' ? 'NISN' : 'Username'}</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">{type === 'student' ? 'Kelas' : 'Status'}</th>
                  <th className="px-3 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...rows].sort((a, b) => b.errors.length - a.errors.length).slice(0, 300).map((r) => (
                  <tr key={r.rowNumber} className={r.errors.length ? 'bg-red-50/60' : ''}>
                    <td className="px-3 py-2 text-slate-500">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.id || '—'}</td>
                    <td className="px-3 py-2">{r.name || '—'}</td>
                    <td className="px-3 py-2">{r.extra || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.errors.length ? <span className="text-red-600">{r.errors.join(' ')}</span> : <span className="text-success-600">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 300 && <p className="text-xs text-slate-500">Menampilkan 300 dari {rows.length} baris (baris bermasalah ditampilkan lebih dulu).</p>}
        </div>
      )}

      {step === 'running' && (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm font-medium text-slate-800">Membuat akun… {progress} / {valid.length}</p>
          <div className="mx-auto h-2.5 max-w-sm overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${(progress / valid.length) * 100}%` }} />
          </div>
          <p className="text-xs text-slate-500">Jangan tutup halaman ini sampai proses selesai.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-success-50 p-4">
              <p className="text-2xl font-semibold text-success-700">{created.length}</p>
              <p className="text-sm text-success-700">akun berhasil dibuat</p>
            </div>
            <div className={cn('rounded-xl p-4', failed.length ? 'bg-red-50' : 'bg-slate-50')}>
              <p className={cn('text-2xl font-semibold', failed.length ? 'text-red-700' : 'text-slate-500')}>{failed.length + invalid}</p>
              <p className={cn('text-sm', failed.length ? 'text-red-700' : 'text-slate-500')}>baris gagal / dilewati</p>
            </div>
          </div>
          {created.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Unduh daftar akun sekarang. Password sementara tidak dapat ditampilkan lagi setelah jendela ini ditutup.
            </div>
          )}
          {failed.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto text-sm scrollbar-thin">
              {failed.map((r) => (
                <li key={r.rowNumber} className="text-red-700">
                  Baris {r.rowNumber} ({r.name}): {r.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
