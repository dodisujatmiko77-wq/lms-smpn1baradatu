import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const schema = z.object({ title: z.string().trim().min(1, 'Judul bab wajib diisi.').max(150), description: z.string().trim().max(500) })

/** mode: 'new' | objek bab */
export function SectionFormModal({ mode, taId, nextPosition, onClose, onSaved }) {
  const isEdit = mode && typeof mode === 'object'
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), values: isEdit ? { title: mode.title, description: mode.description ?? '' } : { title: '', description: '' } })

  const submit = async (v) => {
    try {
      const row = { title: v.title, description: v.description || null }
      if (isEdit) unwrap(await supabase.from('course_sections').update(row).eq('id', mode.id))
      else unwrap(await supabase.from('course_sections').insert({ ...row, teaching_assignment_id: taId, position: nextPosition }))
      toast.success(isEdit ? 'Bab diperbarui.' : 'Bab ditambahkan.')
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      title={isEdit ? 'Ubah bab' : 'Tambah bab / topik'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="section-form" loading={isSubmitting}>Simpan</Button>
        </>
      }
    >
      <form id="section-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Input label="Judul bab" required placeholder="Bab 1: Bilangan Bulat" error={errors.title?.message} {...register('title')} />
        <Textarea label="Deskripsi (opsional)" placeholder="Tujuan pembelajaran bab ini" error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  )
}
