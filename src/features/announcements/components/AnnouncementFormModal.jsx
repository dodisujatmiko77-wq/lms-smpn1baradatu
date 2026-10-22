import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { Switch } from '@/components/ui/Input'
import { fromLocalInput, toLocalInput } from '@/features/tasks/status'
import { toMessage } from '@/lib/errors'
import { akeys, createAnnouncement, fetchTargets, targetFields, targetKey, updateAnnouncement } from '../api'

const RichTextEditor = lazy(() => import('@/features/classroom/components/RichTextEditor'))

function initial(a, defaultTarget) {
  if (a) {
    return {
      target: a.scope === 'school' ? 'school' : a.scope === 'class' ? `class:${a.class_id}` : `course:${a.teaching_assignment_id}`,
      title: a.title,
      body_html: a.body_html ?? '',
      publish_at: toLocalInput(a.publish_at),
      expires_at: a.expires_at ? toLocalInput(a.expires_at) : '',
      is_pinned: a.is_pinned,
    }
  }
  return { target: defaultTarget ?? '', title: '', body_html: '', publish_at: toLocalInput(new Date().toISOString()), expires_at: '', is_pinned: false }
}

/** Buat / ubah pengumuman. Target yang tersedia mengikuti hak pengguna (dicek ulang oleh RLS). */
export function AnnouncementFormModal({ open, announcement, defaultTarget, onClose, onSaved }) {
  const targets = useQuery({ queryKey: akeys.targets, queryFn: fetchTargets, enabled: open })
  const [v, setV] = useState(() => initial(announcement, defaultTarget))
  const [saving, setSaving] = useState(false)
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }))
  const list = targets.data ?? []
  const target = v.target || (list[0] ? targetKey(list[0]) : '')

  const submit = async (e) => {
    e.preventDefault()
    if (!target) return toast.error('Pilih tujuan pengumuman.')
    if (!v.title.trim()) return toast.error('Judul pengumuman wajib diisi.')
    if (v.expires_at && new Date(v.expires_at) <= new Date(v.publish_at)) return toast.error('Batas tayang harus setelah waktu tayang.')
    setSaving(true)
    try {
      const row = {
        title: v.title.trim(),
        body_html: v.body_html || null,
        publish_at: fromLocalInput(v.publish_at),
        expires_at: v.expires_at ? fromLocalInput(v.expires_at) : null,
        is_pinned: v.is_pinned,
      }
      if (announcement) await updateAnnouncement(announcement.id, row)
      else await createAnnouncement({ ...row, ...targetFields(target) })
      const scheduled = new Date(row.publish_at) > new Date()
      toast.success(announcement ? 'Pengumuman diperbarui.' : scheduled ? 'Pengumuman dijadwalkan.' : 'Pengumuman diterbitkan & notifikasi dikirim.')
      onSaved()
    } catch (err) {
      toast.error(toMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={announcement ? 'Ubah pengumuman' : 'Buat pengumuman'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="announcement-form" loading={saving}>{announcement ? 'Simpan' : 'Terbitkan'}</Button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={submit} className="space-y-4" noValidate>
        <Select label="Tujuan" required value={target} onChange={(e) => set('target')(e.target.value)} disabled={Boolean(announcement)} hint={announcement ? 'Tujuan tidak dapat diubah.' : 'Siswa pada tujuan ini menerima notifikasi.'}>
          {targets.isLoading && <option value="">Memuat…</option>}
          {list.map((t) => <option key={targetKey(t)} value={targetKey(t)}>{t.label}</option>)}
        </Select>
        <Input label="Judul" required value={v.title} onChange={(e) => set('title')(e.target.value)} placeholder="Contoh: Jadwal PTS Ganjil" maxLength={200} />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">Isi pengumuman</p>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" />}>
            <RichTextEditor value={v.body_html} onChange={set('body_html')} placeholder="Tulis isi pengumuman…" />
          </Suspense>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Tayang mulai" type="datetime-local" value={v.publish_at} onChange={(e) => set('publish_at')(e.target.value)} hint="Atur ke masa depan untuk menjadwalkan." />
          <Input label="Tayang sampai (opsional)" type="datetime-local" value={v.expires_at} onChange={(e) => set('expires_at')(e.target.value)} hint="Kosongkan bila tidak ada batas." />
        </div>
        <Switch checked={v.is_pinned} onChange={set('is_pinned')} label="Sematkan di atas" description="Pengumuman penting tampil paling atas selama masih tayang." />
      </form>
    </Modal>
  )
}
