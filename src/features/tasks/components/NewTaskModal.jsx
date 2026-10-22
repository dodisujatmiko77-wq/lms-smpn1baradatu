import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Modal } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { createTask } from '../api'
import { fromLocalInput, toLocalInput } from '../status'

const schema = z.object({ title: z.string().trim().min(1, 'Judul tugas wajib diisi.').max(200), due_at: z.string().min(1, 'Tenggat wajib diisi.') })

function defaultDue() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  return toLocalInput(d.toISOString())
}

/** Membuat tugas baru (draf) lalu membuka editornya. */
export function NewTaskModal({ open, taId, onClose, onCreated }) {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), values: { title: '', due_at: defaultDue() } })

  const submit = async (v) => {
    const due = fromLocalInput(v.due_at)
    if (new Date(due) <= new Date()) return toast.error('Tenggat harus di masa depan.')
    try {
      const t = await createTask({ teaching_assignment_id: taId, title: v.title, due_at: due, start_at: new Date().toISOString(), submission_types: ['text', 'file', 'image'], status: 'draft' })
      toast.success('Tugas dibuat sebagai draf. Lengkapi instruksinya lalu terbitkan.')
      onCreated()
      navigate(`/guru/kelas/${taId}/tugas/${t.id}`)
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buat tugas"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="task-form" loading={isSubmitting}>Buat & lengkapi</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Input label="Judul tugas" required placeholder="Laporan pengamatan garis bilangan" error={errors.title?.message} {...register('title')} />
        <Input label="Tenggat pengumpulan" type="datetime-local" required error={errors.due_at?.message} {...register('due_at')} />
      </form>
    </Modal>
  )
}
