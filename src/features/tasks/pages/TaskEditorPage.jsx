import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardCheck, EyeOff, FileText, Paperclip, Plus, Save, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Skeleton, Tabs, Textarea } from '@/components/ui'
import { Switch } from '@/components/ui/Input'
import { AddMaterialModal } from '@/features/classroom/components/AddMaterialModal'
import { MaterialList } from '@/features/classroom/components/materials'
import { PublishBadge } from '@/features/classroom/components/status'
import { useCourse } from '@/features/classroom/hooks'
import { toMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { TASK_BUCKET, addTaskLink, deleteTask, fetchTask, removeTaskAttachment, tkeys, updateTask, uploadTaskAttachment } from '../api'
import { GradingPanel } from '../components/GradingPanel'
import { SUBMISSION_TYPES, fromLocalInput, toLocalInput } from '../status'

const RichTextEditor = lazy(() => import('@/features/classroom/components/RichTextEditor'))

const pick = (t) => ({
  title: t.title,
  description: t.description ?? '',
  instructions_html: t.instructions_html ?? '',
  submission_types: t.submission_types,
  start_at: toLocalInput(t.start_at),
  due_at: toLocalInput(t.due_at),
  max_score: String(Number(t.max_score)),
  allow_late: t.allow_late,
})

export default function TaskEditorPage() {
  const { taId, taskId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'nilai' ? 'nilai' : 'detail'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { course } = useCourse(taId)
  const task = useQuery({ queryKey: tkeys.task(taskId), queryFn: () => fetchTask(taskId) })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeAtt, setRemoveAtt] = useState(null)
  const [removeTask, setRemoveTask] = useState(false)
  const [busy, setBusy] = useState(false)
  const basePath = `/guru/kelas/${taId}`

  const original = useMemo(() => (task.data ? pick(task.data) : null), [task.data])
  const values = form ?? original
  const dirty = Boolean(form && original && JSON.stringify(form) !== JSON.stringify(original))
  const set = (k) => (v) => setForm({ ...values, [k]: v })

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const h = (e) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (task.isLoading || course.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (task.isError) return <Card><ErrorState error={task.error} onRetry={task.refetch} /></Card>
  if (!course.data?.can_manage) return <Card><EmptyState icon={EyeOff} title="Anda tidak dapat mengelola tugas ini" /></Card>

  const t = task.data
  const attachments = (t.attachments ?? []).map((a) => ({ ...a, bucket: TASK_BUCKET }))
  const refresh = () => {
    task.refetch()
    qc.invalidateQueries({ queryKey: tkeys.course(taId) })
  }

  const save = async (extra = {}) => {
    const v = values
    const max = Number(v.max_score)
    const problem = !v.title.trim()
      ? 'Judul tugas wajib diisi.'
      : v.submission_types.length === 0
        ? 'Pilih minimal satu jenis pengumpulan.'
        : !(max >= 1 && max <= 1000)
          ? 'Nilai maksimum 1–1000.'
          : new Date(v.due_at) <= new Date(v.start_at)
            ? 'Tenggat harus setelah tanggal mulai.'
            : null
    if (problem) {
      toast.error(problem)
      return false
    }
    setSaving(true)
    try {
      await updateTask(taskId, {
        title: v.title.trim(),
        description: v.description.trim() || null,
        instructions_html: v.instructions_html || null,
        submission_types: v.submission_types,
        start_at: fromLocalInput(v.start_at),
        due_at: fromLocalInput(v.due_at),
        max_score: max,
        allow_late: v.allow_late,
        ...extra,
      })
      setForm(null)
      refresh()
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    const publishing = t.status !== 'published'
    if (publishing && !values.instructions_html && !values.description.trim() && attachments.length === 0) {
      return toast.error('Isi deskripsi, instruksi, atau lampiran sebelum menerbitkan tugas.')
    }
    if (await save({ status: publishing ? 'published' : 'draft' })) {
      toast.success(publishing ? 'Tugas diterbitkan — siswa kini dapat mengerjakannya.' : 'Tugas ditarik menjadi draf.')
    }
  }

  const run = async (fn, ok) => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast.success(ok)
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggleType = (v) => set('submission_types')(values.submission_types.includes(v) ? values.submission_types.filter((x) => x !== v) : [...values.submission_types, v])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link to={`${basePath}?tab=tugas`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {course.data.subject_name} · {course.data.class_name}
        </Link>
        {tab === 'detail' && (
          <div className="flex flex-wrap items-center gap-2">
            <PublishBadge status={t.status} />
            {dirty && <span className="text-xs font-medium text-accent-600">Ada perubahan belum disimpan</span>}
            <Button variant="outline" icon={Save} disabled={!dirty} loading={saving} onClick={async () => (await save()) && toast.success('Tugas disimpan.')}>Simpan</Button>
            <Button variant={t.status === 'published' ? 'secondary' : 'success'} icon={t.status === 'published' ? EyeOff : Send} loading={saving} onClick={togglePublish}>
              {t.status === 'published' ? 'Tarik ke draf' : 'Terbitkan'}
            </Button>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <Tabs
          className="mt-3 inline-flex"
          value={tab}
          onChange={(v) => setParams(v === 'nilai' ? { tab: 'nilai' } : {}, { replace: true })}
          tabs={[
            { value: 'detail', label: 'Detail tugas', icon: FileText },
            { value: 'nilai', label: 'Pengumpulan & Nilai', icon: ClipboardCheck },
          ]}
        />
      </div>

      {tab === 'nilai' ? (
        t.status === 'published' ? <GradingPanel task={t} canManage /> : <Card><EmptyState icon={ClipboardCheck} title="Tugas belum terbit" description="Terbitkan tugas agar siswa dapat mengumpulkan jawaban." /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card>
              <CardBody className="space-y-4">
                <Input label="Judul tugas" required value={values.title} onChange={(e) => set('title')(e.target.value)} />
                <Textarea label="Deskripsi singkat" rows={2} value={values.description} onChange={(e) => set('description')(e.target.value)} placeholder="Tampil di daftar tugas siswa" />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">Jenis pengumpulan</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBMISSION_TYPES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleType(o.value)}
                        aria-pressed={values.submission_types.includes(o.value)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                          values.submission_types.includes(o.value) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input label="Mulai" type="datetime-local" value={values.start_at} onChange={(e) => set('start_at')(e.target.value)} />
                  <Input label="Tenggat" type="datetime-local" value={values.due_at} onChange={(e) => set('due_at')(e.target.value)} />
                  <Input label="Nilai maksimum" type="number" min={1} max={1000} value={values.max_score} onChange={(e) => set('max_score')(e.target.value)} />
                </div>
                <Switch checked={values.allow_late} onChange={set('allow_late')} label="Terima pengumpulan terlambat" description="Pengumpulan setelah tenggat tetap diterima dan ditandai Terlambat. Bila dimatikan, siswa tidak dapat mengumpulkan setelah tenggat (dicek dengan waktu server)." />
              </CardBody>
            </Card>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Instruksi</p>
              <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-slate-100" />}>
                <RichTextEditor value={values.instructions_html} onChange={set('instructions_html')} placeholder="Tuliskan langkah-langkah pengerjaan, kriteria penilaian, dan format jawaban…" />
              </Suspense>
            </div>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader icon={Paperclip} title="Lampiran" description="Lembar kerja, contoh, atau sumber" action={<Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>Tambah</Button>} />
              <CardBody>
                {attachments.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Belum ada lampiran.</p> : <MaterialList materials={attachments} mode="manage" onDelete={setRemoveAtt} />}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Button variant="ghost" size="sm" icon={Trash2} className="-ml-2 text-red-600 hover:bg-red-50" onClick={() => setRemoveTask(true)}>Hapus tugas</Button>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <AddMaterialModal
        open={addOpen}
        title="Tambah lampiran tugas"
        uploadFile={(file, title) => uploadTaskAttachment(t, file, title)}
        addLink={(link) => addTaskLink(t, link)}
        onClose={() => setAddOpen(false)}
        onAdded={refresh}
      />
      <ConfirmDialog
        open={Boolean(removeAtt)}
        onClose={() => setRemoveAtt(null)}
        loading={busy}
        onConfirm={async () => {
          if (await run(() => removeTaskAttachment(t, removeAtt), 'Lampiran dihapus.')) {
            setRemoveAtt(null)
            refresh()
          }
        }}
        title="Hapus lampiran?"
        confirmLabel="Hapus"
        message={removeAtt && `"${removeAtt.title}" akan dihapus.`}
      />
      <ConfirmDialog
        open={removeTask}
        onClose={() => setRemoveTask(false)}
        loading={busy}
        onConfirm={async () => {
          if (await run(() => deleteTask(t), 'Tugas dihapus beserta pengumpulan & nilainya.')) {
            setForm(null)
            qc.invalidateQueries({ queryKey: tkeys.all })
            navigate(`${basePath}?tab=tugas`, { replace: true })
          }
        }}
        title="Hapus tugas?"
        confirmLabel="Hapus permanen"
        message="Tugas, seluruh jawaban siswa, berkasnya, dan nilainya akan dihapus permanen."
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Tinggalkan tanpa menyimpan?"
        confirmLabel="Tinggalkan"
        message="Perubahan pada tugas ini belum disimpan dan akan hilang."
      />
    </div>
  )
}
