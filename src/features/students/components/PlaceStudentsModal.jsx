import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Modal, Select } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/** Menempatkan beberapa siswa terpilih ke satu kelas sekaligus. */
export function PlaceStudentsModal({ open, studentIds, classes, onClose, onDone }) {
  const [classId, setClassId] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const n = unwrap(await supabase.rpc('enroll_students', { p_class_id: classId, p_student_ids: studentIds }))
      toast.success(`${n} siswa ditempatkan di ${classes.find((c) => c.id === classId)?.name}.`)
      onDone()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Tempatkan ${studentIds.length} siswa`}
      description="Siswa yang sudah punya kelas di tahun pelajaran ini akan dipindahkan."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} loading={saving} disabled={!classId}>Tempatkan</Button>
        </>
      }
    >
      <Select label="Kelas tujuan" value={classId} onChange={(e) => setClassId(e.target.value)}>
        <option value="">— Pilih kelas —</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.student_count}/{c.capacity})</option>
        ))}
      </Select>
    </Modal>
  )
}
