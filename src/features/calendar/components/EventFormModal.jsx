import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { akeys, fetchTargets } from '@/features/announcements/api'
import { toMessage } from '@/lib/errors'
import { CATEGORIES, createEvent, deleteEvent, updateEvent } from '../api'

/** Tambah / ubah agenda sekolah (admin) atau agenda kelas (admin & wali kelas). */
export function EventFormModal({ open, event, defaultDate, onClose, onSaved }) {
  // Target pengumuman = cakupan yang sama dengan hak membuat agenda (sekolah: admin; kelas: admin/wali).
  const targets = useQuery({ queryKey: akeys.targets, queryFn: fetchTargets, enabled: open })
  const options = (targets.data ?? []).filter((t) => t.scope !== 'course')
  const [v, setV] = useState(() => ({
    target: event ? (event.scope === 'school' ? 'school' : `class:${event.class_id}`) : '',
    title: event?.title ?? '',
    description: event?.description ?? '',
    category: event?.category ?? 'activity',
    start_date: event?.start_date ?? defaultDate,
    end_date: event?.end_date ?? defaultDate,
  }))
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const target = v.target || (options[0] ? (options[0].scope === 'school' ? 'school' : `class:${options[0].id}`) : '')

  const run = async (fn, ok) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const submit = (e) => {
    e.preventDefault()
    if (!v.title.trim()) return toast.error('Nama agenda wajib diisi.')
    if (!v.start_date || !v.end_date || v.end_date < v.start_date) return toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai.')
    const row = { title: v.title.trim(), description: v.description.trim() || null, category: v.category, start_date: v.start_date, end_date: v.end_date }
    if (event) return run(() => updateEvent(event.id, row), 'Agenda diperbarui.')
    const [scope, classId] = target === 'school' ? ['school', null] : ['class', target.split(':')[1]]
    return run(() => createEvent({ ...row, scope, class_id: classId }), 'Agenda ditambahkan ke kalender.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Ubah agenda' : 'Tambah agenda'}
      footer={
        <>
          {event && <Button variant="ghost" className="text-red-600 hover:bg-red-50 sm:mr-auto" disabled={busy} onClick={() => run(() => deleteEvent(event.id), 'Agenda dihapus.')}>Hapus</Button>}
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="event-form" loading={busy}>Simpan</Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4" noValidate>
        <Select label="Untuk" value={target} onChange={set('target')} disabled={Boolean(event)}>
          {options.map((t) => <option key={t.scope + (t.id ?? '')} value={t.scope === 'school' ? 'school' : `class:${t.id}`}>{t.scope === 'school' ? 'Seluruh sekolah' : t.label}</option>)}
        </Select>
        <Input label="Nama agenda" required value={v.title} onChange={set('title')} maxLength={150} placeholder="Contoh: Penilaian Tengah Semester" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Jenis" value={v.category} onChange={set('category')}>
            {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </Select>
          <Input label="Mulai" type="date" value={v.start_date} onChange={set('start_date')} />
          <Input label="Selesai" type="date" value={v.end_date} min={v.start_date} onChange={set('end_date')} />
        </div>
        <Textarea label="Keterangan" rows={2} value={v.description} onChange={set('description')} placeholder="Opsional" />
      </form>
    </Modal>
  )
}
