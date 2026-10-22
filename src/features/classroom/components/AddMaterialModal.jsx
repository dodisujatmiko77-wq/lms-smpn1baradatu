import { useRef, useState } from 'react'
import { CheckCircle2, Film, Link2, Loader2, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Button, Input, Modal, Tabs } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { compressImage, fileExt, fileInfo, formatBytes } from '@/lib/files'
import { youtubeId } from '@/lib/youtube'
import { cn } from '@/lib/utils'

/**
 * Tambah materi/lampiran: unggah berkas (bisa banyak), video YouTube, atau tautan.
 * uploadFile(file, title, index) dan addLink({ type, url, title }) disediakan pemanggil
 * (pertemuan → lesson_materials; tugas → lampiran tugas).
 */
export function AddMaterialModal({ open, uploadFile, addLink: saveLink, onClose, onAdded, title: modalTitle = 'Tambah materi' }) {
  const settings = useSchoolSettings()
  const [tab, setTab] = useState('file')
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const allowed = (settings.allowed_file_types ?? []).filter((ext) => fileInfo(`x.${ext}`))
  const reset = () => {
    setItems([])
    setUrl('')
    setTitle('')
    setError(null)
  }
  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const uploadFiles = async (files) => {
    const list = [...files].map((f) => ({ file: f, name: f.name, status: 'waiting' }))
    setItems(list)
    setBusy(true)
    let ok = 0
    for (let i = 0; i < list.length; i++) {
      const update = (patch) => setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...patch } : it)))
      let file = list[i].file
      const ext = fileExt(file.name)
      try {
        if (!allowed.includes(ext)) throw new Error(`Jenis berkas .${ext} tidak diizinkan (atur di Pengaturan Sekolah).`)
        update({ status: 'uploading' })
        const isImage = fileInfo(file.name).type === 'image'
        if (isImage) file = await compressImage(file)
        const limitMb = isImage ? settings.max_image_upload_mb : settings.max_upload_mb
        if (file.size > limitMb * 1024 * 1024) throw new Error(`Ukuran ${formatBytes(file.size)} melebihi batas ${limitMb} MB.`)
        await uploadFile(file, list[i].name.replace(/\.[^.]+$/, ''), i)
        update({ status: 'done', size: file.size })
        ok++
      } catch (e) {
        update({ status: 'error', error: toMessage(e) })
      }
    }
    setBusy(false)
    if (ok) {
      toast.success(`${ok} berkas diunggah.`)
      onAdded()
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const addLink = async () => {
    setError(null)
    const isVideo = tab === 'video'
    const u = url.trim()
    if (isVideo && !youtubeId(u)) return setError('Masukkan tautan video YouTube yang valid.')
    if (!isVideo && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(u)) return setError('Tautan harus diawali https:// atau http://')
    if (title.trim().length < 2) return setError('Judul materi wajib diisi.')
    setBusy(true)
    try {
      await saveLink({ type: isVideo ? 'video' : 'link', url: u, title: title.trim() })
      toast.success(isVideo ? 'Video ditambahkan.' : 'Tautan ditambahkan.')
      reset()
      onAdded()
      onClose()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      dismissible={!busy}
      title={modalTitle}
      description="Video sebaiknya melalui YouTube agar tidak memakai kuota penyimpanan sekolah."
      footer={
        tab === 'file' ? (
          <Button variant="outline" onClick={close} disabled={busy}>{items.some((i) => i.status === 'done') ? 'Selesai' : 'Tutup'}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={busy}>Batal</Button>
            <Button onClick={addLink} loading={busy}>Tambahkan</Button>
          </>
        )
      }
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={(v) => {
          if (!busy) {
            setTab(v)
            setError(null)
          }
        }}
        tabs={[
          { value: 'file', label: 'Unggah berkas', icon: Upload },
          { value: 'video', label: 'Video YouTube', icon: Film },
          { value: 'link', label: 'Tautan', icon: Link2 },
        ]}
      />
      {tab === 'file' ? (
        <div className="space-y-3">
          <label
            className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-8 text-center transition hover:border-primary-400 hover:bg-primary-50/40', busy && 'pointer-events-none opacity-60')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
            }}
          >
            <Upload className="h-8 w-8 text-primary-500" />
            <span className="text-sm font-medium text-slate-800">Klik atau seret berkas ke sini (bisa lebih dari satu)</span>
            <span className="text-xs text-slate-500">
              {allowed.map((e) => e.toUpperCase()).join(', ')} · dokumen maks. {settings.max_upload_mb} MB · gambar maks. {settings.max_image_upload_mb} MB (dikompres otomatis)
            </span>
            <input ref={fileRef} type="file" multiple className="hidden" accept={allowed.map((e) => `.${e}`).join(',')} onChange={(e) => e.target.files?.length && uploadFiles(e.target.files)} />
          </label>
          {items.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  {it.status === 'uploading' || it.status === 'waiting' ? (
                    <Loader2 className={cn('h-4 w-4 shrink-0', it.status === 'uploading' ? 'animate-spin text-primary-500' : 'text-slate-300')} />
                  ) : it.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  <span className={cn('text-xs', it.status === 'error' ? 'text-red-600' : 'text-slate-500')}>
                    {it.status === 'error' ? it.error : it.status === 'done' ? formatBytes(it.size) : it.status === 'uploading' ? 'Mengunggah…' : 'Menunggu'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Input
            label={tab === 'video' ? 'Tautan video YouTube' : 'Alamat tautan'}
            placeholder={tab === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Input label="Judul materi" placeholder={tab === 'video' ? 'Video: Penjumlahan bilangan bulat' : 'Sumber belajar tambahan'} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      )}
    </Modal>
  )
}
