import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { useSubjects } from '@/features/master/hooks'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { createBank, updateBank } from '../api'

/** Buat / ubah bank soal. `bank` null = baru. */
export function BankFormModal({ open, bank, onClose, onSaved }) {
  const { profile } = useAuth()
  const subjects = useSubjects({ activeOnly: true })
  const teaching = useQuery({ queryKey: ['my-teaching'], queryFn: async () => unwrap(await supabase.rpc('get_my_teaching')) })
  const mine = new Set((teaching.data ?? []).map((t) => t.subject_id))
  const firstMine = teaching.data?.[0]
  const [v, setV] = useState(() => ({
    name: bank?.name ?? '',
    description: bank?.description ?? '',
    subject_id: bank?.subject_id ?? '',
    grade: bank?.grade ? String(bank.grade) : '',
  }))
  const [saving, setSaving] = useState(false)
  const subjectId = v.subject_id || firstMine?.subject_id || ''
  const grade = v.grade || (bank ? '' : firstMine?.grade ? String(firstMine.grade) : '')
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const list = [...(subjects.data ?? [])].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)))

  const submit = async (e) => {
    e.preventDefault()
    if (!v.name.trim()) return toast.error('Nama bank soal wajib diisi.')
    if (!subjectId) return toast.error('Pilih mata pelajaran.')
    setSaving(true)
    try {
      const row = { name: v.name.trim(), description: v.description.trim() || null, subject_id: subjectId, grade: grade ? Number(grade) : null }
      if (bank) await updateBank(bank.id, row)
      else await createBank({ ...row, teacher_id: profile.teacher_id })
      toast.success(bank ? 'Bank soal diperbarui.' : 'Bank soal dibuat. Tambahkan soal-soalnya.')
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
      title={bank ? 'Ubah bank soal' : 'Bank soal baru'}
      description="Kumpulan soal per materi yang dapat dipakai ulang di banyak kuis dan kelas."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="bank-form" loading={saving}>Simpan</Button>
        </>
      }
    >
      <form id="bank-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Nama bank soal" required value={v.name} onChange={set('name')} placeholder="Bab 1 — Bilangan Bulat" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Mata pelajaran" required value={subjectId} onChange={set('subject_id')}>
            <option value="">Pilih mapel…</option>
            {list.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{mine.has(s.id) ? ' (diampu)' : ''}</option>
            ))}
          </Select>
          <Select label="Kelas (tingkat)" value={grade} onChange={set('grade')}>
            <option value="">Semua tingkat</option>
            <option value="7">Kelas 7</option>
            <option value="8">Kelas 8</option>
            <option value="9">Kelas 9</option>
          </Select>
        </div>
        <Textarea label="Keterangan" rows={2} value={v.description} onChange={set('description')} placeholder="Opsional" />
      </form>
    </Modal>
  )
}
