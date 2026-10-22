import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, Paperclip, Plus, Save, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Textarea } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { formatRelative } from '@/lib/utils'
import { ckeys, deleteLesson, deleteMaterial, fetchLesson, uploadMaterial } from '../api'
import { AddMaterialModal } from '../components/AddMaterialModal'
import { MaterialList } from '../components/materials'
import { RichContent } from '../components/RichContent'
import { PublishBadge } from '../components/status'
import { useCourse, useInvalidateClassroom } from '../hooks'

const RichTextEditor = lazy(() => import('../components/RichTextEditor'))

const pick = (l) => ({ title: l.title, meeting_number: l.meeting_number ?? '', section_id: l.section_id ?? '', summary: l.summary ?? '', content_html: l.content_html ?? '' })

export default function LessonEditorPage() {
  const { taId, lessonId } = useParams()
  const navigate = useNavigate()
  const settings = useSchoolSettings()
  const invalidate = useInvalidateClassroom()
  const { course, sections } = useCourse(taId)
  const lesson = useQuery({ queryKey: ckeys.lesson(lessonId), queryFn: () => fetchLesson(lessonId) })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [removeMaterial, setRemoveMaterial] = useState(null)
  const [removeLesson, setRemoveLesson] = useState(false)
  const [busy, setBusy] = useState(false)
  const basePath = `/guru/kelas/${taId}`

  const original = useMemo(() => (lesson.data ? pick(lesson.data) : null), [lesson.data])
  const values = form ?? original
  const dirty = Boolean(form && original && JSON.stringify(form) !== JSON.stringify(original))
  const set = (k) => (v) => setForm({ ...values, [k]: v })

  // Peringatan bila meninggalkan halaman dengan perubahan belum disimpan.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  if (lesson.isLoading || course.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (lesson.isError) return <Card><ErrorState error={lesson.error} onRetry={lesson.refetch} /></Card>
  if (!course.data?.can_manage) return <Card><EmptyState icon={EyeOff} title="Anda tidak dapat mengubah pertemuan ini" /></Card>

  const l = lesson.data
  const materials = l.lesson_materials ?? []

  const save = async (extra = {}) => {
    if (!values.title.trim()) {
      toast.error('Judul pertemuan wajib diisi.')
      return false
    }
    setSaving(true)
    try {
      unwrap(
        await supabase
          .from('lessons')
          .update({
            title: values.title.trim(),
            meeting_number: values.meeting_number === '' ? null : Number(values.meeting_number),
            section_id: values.section_id || null,
            summary: values.summary.trim() || null,
            content_html: values.content_html || null,
            ...extra,
          })
          .eq('id', lessonId),
      )
      setForm(null)
      await lesson.refetch()
      invalidate()
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    const publishing = l.status !== 'published'
    if (publishing && !values.content_html && materials.length === 0) {
      toast.error('Isi materi atau tambahkan minimal satu lampiran sebelum dipublikasikan.')
      return
    }
    if (await save({ status: publishing ? 'published' : 'draft' })) {
      toast.success(publishing ? 'Pertemuan dipublikasikan — siswa kini dapat membacanya.' : 'Pertemuan ditarik menjadi draf dan disembunyikan dari siswa.')
    }
  }

  const doRemoveMaterial = async () => {
    setBusy(true)
    try {
      await deleteMaterial(removeMaterial)
      toast.success('Materi dihapus.')
      setRemoveMaterial(null)
      lesson.refetch()
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doRemoveLesson = async () => {
    setBusy(true)
    try {
      await deleteLesson(lessonId)
      setForm(null)
      toast.success('Pertemuan dihapus beserta berkasnya.')
      invalidate()
      navigate(basePath, { replace: true })
    } catch (e) {
      toast.error(toMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {course.data.subject_name} · {course.data.class_name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PublishBadge status={l.status} />
          {dirty && <span className="text-xs font-medium text-accent-600">Ada perubahan belum disimpan</span>}
          <Button variant="outline" icon={Eye} onClick={() => setPreview(true)}>Pratinjau</Button>
          <Button variant="outline" icon={Save} loading={saving && !blocker.state} disabled={!dirty} onClick={async () => (await save()) && toast.success('Perubahan disimpan.')}>Simpan</Button>
          <Button variant={l.status === 'published' ? 'secondary' : 'success'} icon={l.status === 'published' ? EyeOff : Send} onClick={togglePublish} loading={saving}>
            {l.status === 'published' ? 'Tarik ke draf' : 'Publikasikan'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <Input label="Pertemuan ke-" type="number" min={1} max={200} value={values.meeting_number} onChange={(e) => set('meeting_number')(e.target.value)} />
                <Input label="Judul pertemuan" required value={values.title} onChange={(e) => set('title')(e.target.value)} />
              </div>
              <Select label="Bab" value={values.section_id} onChange={(e) => set('section_id')(e.target.value)}>
                <option value="">Tanpa bab</option>
                {(sections.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </Select>
              <Textarea label="Ringkasan / tujuan pembelajaran" rows={2} placeholder="Setelah pertemuan ini, siswa mampu…" value={values.summary} onChange={(e) => set('summary')(e.target.value)} />
            </CardBody>
          </Card>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Isi materi</p>
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-slate-100" />}>
              <RichTextEditor value={values.content_html} onChange={set('content_html')} />
            </Suspense>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={Paperclip}
              title="Lampiran materi"
              description="PDF, gambar, presentasi, video YouTube, tautan"
              action={<Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>Tambah</Button>}
            />
            <CardBody>
              {materials.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Belum ada lampiran.</p>
              ) : (
                <MaterialList materials={materials} mode="manage" onDelete={setRemoveMaterial} />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>Dibuat {formatRelative(l.created_at)} · diubah {formatRelative(l.updated_at)}</p>
              {l.published_at && <p>Terbit {formatRelative(l.published_at)}</p>}
              {settings.material_requires_publish && l.status === 'draft' && <p className="text-accent-700">Siswa belum dapat melihat pertemuan ini sampai Anda menekan <b>Publikasikan</b>.</p>}
              <Button variant="ghost" size="sm" icon={Trash2} className="-ml-2 text-red-600 hover:bg-red-50" onClick={() => setRemoveLesson(true)}>Hapus pertemuan</Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <AddMaterialModal
        open={addOpen}
        uploadFile={(file, title, i) => uploadMaterial({ taId, lessonId, file, title, position: materials.length + i })}
        addLink={async ({ type, url, title }) =>
          unwrap(await supabase.from('lesson_materials').insert({ lesson_id: lessonId, type, title, url, position: materials.length }))
        }
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          lesson.refetch()
          invalidate()
        }}
      />

      <Modal open={preview} onClose={() => setPreview(false)} size="lg" title={`Pratinjau: ${values.title}`} description="Tampilan yang dilihat siswa (perubahan belum disimpan ikut ditampilkan).">
        <div className="space-y-5">
          {values.summary && <p className="rounded-xl bg-primary-50 p-3 text-sm text-primary-800">{values.summary}</p>}
          <RichContent html={values.content_html} />
          <MaterialList materials={materials} />
          {!values.content_html && materials.length === 0 && <p className="text-sm text-slate-400">Belum ada isi.</p>}
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(removeMaterial)} onClose={() => setRemoveMaterial(null)} onConfirm={doRemoveMaterial} loading={busy} title="Hapus materi?" confirmLabel="Hapus" message={removeMaterial && `"${removeMaterial.title}" akan dihapus${removeMaterial.storage_path ? ' beserta berkasnya' : ''}.`} />
      <ConfirmDialog open={removeLesson} onClose={() => setRemoveLesson(false)} onConfirm={doRemoveLesson} loading={busy} title="Hapus pertemuan?" confirmLabel="Hapus permanen" message={`Pertemuan "${l.title}", ${materials.length} lampirannya, dan progress belajar siswa pada pertemuan ini akan dihapus permanen.`} />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Tinggalkan tanpa menyimpan?"
        confirmLabel="Tinggalkan"
        message="Perubahan pada pertemuan ini belum disimpan dan akan hilang."
      />
    </div>
  )
}
