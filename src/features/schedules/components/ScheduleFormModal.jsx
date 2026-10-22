import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { DAYS } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const schema = z
  .object({
    teaching_assignment_id: z.string().min(1, 'Pilih mata pelajaran.'),
    day_of_week: z.coerce.number().int().min(1).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}/, 'Wajib diisi.'),
    end_time: z.string().regex(/^\d{2}:\d{2}/, 'Wajib diisi.'),
    room: z.string().trim().max(50),
  })
  .refine((v) => v.end_time > v.start_time, { path: ['end_time'], message: 'Harus setelah jam mulai.' })

/** mode: { day } untuk tambah, atau objek jadwal untuk ubah. assignments: penugasan kelas tsb. */
export function ScheduleFormModal({ mode, assignments, onClose, onSaved }) {
  const isEdit = Boolean(mode?.id)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: mode
      ? {
          teaching_assignment_id: mode.teaching_assignment_id ?? '',
          day_of_week: mode.day_of_week ?? mode.day ?? 1,
          start_time: mode.start_time?.slice(0, 5) ?? '07:30',
          end_time: mode.end_time?.slice(0, 5) ?? '08:50',
          room: mode.room ?? '',
        }
      : undefined,
  })

  const submit = async (v) => {
    const row = { ...v, room: v.room || null }
    try {
      if (isEdit) unwrap(await supabase.from('schedules').update(row).eq('id', mode.id))
      else unwrap(await supabase.from('schedules').insert(row))
      toast.success(isEdit ? 'Jadwal diperbarui.' : 'Jadwal ditambahkan.')
      onSaved()
    } catch (e) {
      toast.error(toMessage(e), { duration: 7000 })
    }
  }

  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      title={isEdit ? 'Ubah jadwal' : 'Tambah jadwal'}
      description="Sistem menolak otomatis jadwal yang bentrok di kelas yang sama atau guru yang sama."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="schedule-form" loading={isSubmitting}>Simpan</Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Select label="Mata pelajaran — guru" required error={errors.teaching_assignment_id?.message} {...register('teaching_assignment_id')}>
          <option value="">— Pilih —</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>{a.subject.name} — {a.teacher.profile.full_name}</option>
          ))}
        </Select>
        <Select label="Hari" {...register('day_of_week')}>
          {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Jam mulai" type="time" step={300} error={errors.start_time?.message} {...register('start_time')} />
          <Input label="Jam selesai" type="time" step={300} error={errors.end_time?.message} {...register('end_time')} />
        </div>
        <Input label="Ruang (opsional)" placeholder="Kosongkan untuk memakai ruang kelas" error={errors.room?.message} {...register('room')} />
      </form>
    </Modal>
  )
}
