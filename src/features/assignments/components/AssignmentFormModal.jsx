import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { useClasses, useSubjects, useTeacherOptions } from '@/features/master/hooks'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const schema = z.object({
  teacher_id: z.string().min(1, 'Pilih guru.'),
  subject_id: z.string().min(1, 'Pilih mata pelajaran.'),
  hours_per_week: z.union([z.literal(''), z.coerce.number().int().min(1, 'Minimal 1.').max(20, 'Maksimal 20.')]),
})

/**
 * mode: 'new' | objek penugasan (ubah guru/jam).
 * fixedClassId: bila diisi (dari halaman detail kelas), kelas tidak bisa dipilih.
 */
export function AssignmentFormModal({ mode, semesterId, yearId, fixedClassId, onClose, onSaved }) {
  const isEdit = mode && typeof mode === 'object'
  const teachers = useTeacherOptions()
  const subjects = useSubjects({ activeOnly: true })
  const classes = useClasses(yearId, semesterId)
  const [classIds, setClassIds] = useState(() => (fixedClassId ? [fixedClassId] : []))
  const [classError, setClassError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: isEdit
      ? { teacher_id: mode.teacher.id, subject_id: mode.subject.id, hours_per_week: mode.hours_per_week ?? '' }
      : { teacher_id: '', subject_id: '', hours_per_week: '' },
  })

  const toggleClass = (id) => setClassIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = async (v) => {
    const hours = v.hours_per_week === '' ? null : v.hours_per_week
    try {
      if (isEdit) {
        unwrap(await supabase.from('teaching_assignments').update({ teacher_id: v.teacher_id, hours_per_week: hours }).eq('id', mode.id))
        toast.success('Penugasan diperbarui.')
      } else {
        if (classIds.length === 0) return setClassError('Pilih minimal satu kelas.')
        const rows = classIds.map((class_id) => ({ teacher_id: v.teacher_id, subject_id: v.subject_id, class_id, semester_id: semesterId, hours_per_week: hours }))
        const res = unwrap(
          await supabase.from('teaching_assignments').upsert(rows, { onConflict: 'class_id,subject_id,semester_id', ignoreDuplicates: true }).select('id'),
        )
        const skipped = rows.length - res.length
        if (res.length) toast.success(`${res.length} penugasan dibuat.`)
        if (skipped) toast.warning(`${skipped} kelas dilewati karena mapel tersebut sudah memiliki guru.`)
      }
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  const grouped = [7, 8, 9].map((g) => (classes.data ?? []).filter((c) => c.grade === g)).filter((l) => l.length)

  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      title={isEdit ? `Ubah penugasan ${mode.subject.name} — ${mode.class.name}` : 'Tambah penugasan mengajar'}
      description={isEdit ? 'Kelas dan mapel tidak dapat diubah; hapus lalu buat penugasan baru bila perlu.' : 'Satu guru dapat ditugaskan ke beberapa kelas sekaligus.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="assignment-form" loading={isSubmitting}>Simpan</Button>
        </>
      }
    >
      <form id="assignment-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Select label="Guru" required error={errors.teacher_id?.message} {...register('teacher_id')}>
          <option value="">— Pilih guru —</option>
          {(teachers.data ?? []).filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
        <Select label="Mata pelajaran" required disabled={isEdit} error={errors.subject_id?.message} {...register('subject_id')}>
          <option value="">— Pilih mapel —</option>
          {(subjects.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {!isEdit && !fixedClassId && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Kelas<span className="ml-0.5 text-red-500">*</span></p>
            {grouped.length === 0 && <p className="text-sm text-slate-500">Belum ada kelas pada tahun pelajaran ini.</p>}
            {grouped.map((list) => (
              <div key={list[0].grade} className="flex flex-wrap gap-1.5">
                {list.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      toggleClass(c.id)
                      setClassError(null)
                    }}
                    aria-pressed={classIds.includes(c.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                      classIds.includes(c.id) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ))}
            {classError && <p className="text-xs font-medium text-red-600">{classError}</p>}
          </div>
        )}
        <Input label="Jam pelajaran per minggu" type="number" min={1} max={20} placeholder="Opsional" error={errors.hours_per_week?.message} {...register('hours_per_week')} />
      </form>
    </Modal>
  )
}
