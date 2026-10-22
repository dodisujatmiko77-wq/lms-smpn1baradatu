import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { createTopic, updateTopic } from '../api'

/** Buat / ubah topik diskusi. */
export function TopicFormModal({ open, taId, topic, onClose, onSaved }) {
  const [title, setTitle] = useState(topic?.title ?? '')
  const [body, setBody] = useState(topic?.body ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return toast.error('Judul topik wajib diisi.')
    if (!body.trim()) return toast.error('Isi topik wajib diisi.')
    setSaving(true)
    try {
      const res = topic
        ? await updateTopic(topic.id, { title: title.trim(), body: body.trim() })
        : await createTopic({ teaching_assignment_id: taId, title: title.trim(), body: body.trim() })
      toast.success(topic ? 'Topik diperbarui.' : 'Topik diskusi dibuat.')
      onSaved(res.id)
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
      title={topic ? 'Ubah topik' : 'Topik diskusi baru'}
      description={topic ? undefined : 'Tanyakan materi yang belum dipahami atau ajak teman berdiskusi. Gunakan bahasa yang sopan.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="topic-form" loading={saving}>{topic ? 'Simpan' : 'Kirim topik'}</Button>
        </>
      }
    >
      <form id="topic-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Judul" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Contoh: Bagaimana cara menentukan garis lintang?" />
        <Textarea label="Isi" required rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} hint={`${body.length}/5000 karakter`} />
      </form>
    </Modal>
  )
}
