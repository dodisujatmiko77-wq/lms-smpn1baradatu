import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { fromLocalInput, toLocalInput } from '@/features/tasks/status'
import { toMessage } from '@/lib/errors'
import { createQuiz } from '../api'

function defaults() {
  const open = new Date()
  open.setDate(open.getDate() + 1)
  open.setHours(7, 30, 0, 0)
  const close = new Date(open)
  close.setHours(close.getHours() + 2)
  return { title: '', kind: 'quiz', open_at: toLocalInput(open.toISOString()), close_at: toLocalInput(close.toISOString()), duration: '30' }
}

/** Membuat kuis baru (draf) lalu membuka editornya. */
export function NewQuizModal({ open, taId, onClose, onCreated }) {
  const navigate = useNavigate()
  const [v, setV] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const dur = Number(v.duration)
    if (!v.title.trim()) return toast.error('Judul kuis wajib diisi.')
    if (!(dur >= 1 && dur <= 300)) return toast.error('Durasi 1–300 menit.')
    if (new Date(v.close_at) <= new Date(v.open_at)) return toast.error('Waktu tutup harus setelah waktu buka.')
    setSaving(true)
    try {
      const q = await createQuiz({
        teaching_assignment_id: taId,
        title: v.title.trim(),
        kind: v.kind,
        open_at: fromLocalInput(v.open_at),
        close_at: fromLocalInput(v.close_at),
        duration_minutes: dur,
        status: 'draft',
      })
      toast.success('Kuis dibuat sebagai draf. Tambahkan soal lalu terbitkan.')
      onCreated()
      navigate(`/guru/kelas/${taId}/kuis/${q.id}?tab=soal`)
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
      title="Buat kuis / ujian"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="quiz-form" loading={saving}>Buat & pilih soal</Button>
        </>
      }
    >
      <form id="quiz-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Judul" required value={v.title} onChange={set('title')} placeholder="Kuis Bab 1 — Bilangan Bulat" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Jenis" value={v.kind} onChange={set('kind')}>
            <option value="quiz">Kuis (latihan/ulangan harian)</option>
            <option value="exam">Ujian (PTS/PAS)</option>
          </Select>
          <Input label="Durasi (menit)" type="number" min={1} max={300} value={v.duration} onChange={set('duration')} />
          <Input label="Dibuka" type="datetime-local" value={v.open_at} onChange={set('open_at')} />
          <Input label="Ditutup" type="datetime-local" value={v.close_at} onChange={set('close_at')} />
        </div>
        <p className="text-xs text-slate-500">Siswa bisa mulai kapan saja di antara waktu buka dan tutup. Waktu pengerjaan dihitung server sejak siswa menekan Mulai, dan berakhir paling lambat saat kuis ditutup.</p>
      </form>
    </Modal>
  )
}
