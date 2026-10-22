import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  title: z.string().trim().min(1, 'Judul pertemuan wajib diisi.').max(200),
  meeting_number: z.coerce.number().int().min(1).max(200),
  section_id: z.string(),
})

/** Membuat pertemuan baru (draf) lalu membuka editornya. */
export function NewLessonModal({ open, taId, sections, nextNumber, defaultSectionId, basePath, onClose, onCreated }) {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), values: { title: '', meeting_number: nextNumber, section_id: defaultSectionId ?? sections[sections.length - 1]?.id ?? '' } })

  const submit = async (v) => {
    try {
      const lesson = unwrap(
        await supabase
          .from('lessons')
          .insert({ teaching_assignment_id: taId, title: v.title, meeting_number: v.meeting_number, section_id: v.section_id || null, status: 'draft' })
          .select('id')
          .single(),
      )
      toast.success('Pertemuan dibuat sebagai draf. Lengkapi materinya lalu publikasikan.')
      onCreated()
      navigate(`${basePath}/pertemuan/${lesson.id}`)
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah pertemuan"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="lesson-form" loading={isSubmitting}>Buat & isi materi</Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Input label="Pertemuan ke-" type="number" min={1} max={200} error={errors.meeting_number?.message} {...register('meeting_number')} />
          <Input label="Judul pertemuan" required placeholder="Bilangan Bulat" error={errors.title?.message} {...register('title')} />
        </div>
        <Select label="Bab" {...register('section_id')}>
          <option value="">Tanpa bab</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </Select>
      </form>
    </Modal>
  )
}
