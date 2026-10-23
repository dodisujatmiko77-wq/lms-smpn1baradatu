import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Lock, Paperclip, Save, Send, Star, Trash2, Undo2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Button, Card, CardBody, ConfirmDialog, EmptyState, Input, Skeleton, Textarea } from '@/components/ui'
import { MaterialList } from '@/features/classroom/components/materials'
import { RichContent } from '@/features/classroom/components/RichContent'
import { toMessage } from '@/lib/errors'
import { compressImage, fileExt, fileInfo, formatBytes } from '@/lib/files'
import { formatDate } from '@/lib/utils'
import { TASK_BUCKET, fetchMySubmission, fetchMyTasks, fetchTask, removeSubmissionFile, saveSubmission, tkeys, uploadSubmissionFile } from '../api'
import { DueLabel, TaskStatusBadge, studentTaskStatus } from '../status'

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp']

/** Halaman mengerjakan & mengumpulkan tugas (siswa). */
export default function TaskSubmitPage() {
  const { taskId } = useParams()
  const { profile } = useAuth()
  const settings = useSchoolSettings()
  const qc = useQueryClient()
  const mine = useQuery({ queryKey: tkeys.mine, queryFn: fetchMyTasks })
  const task = useQuery({ queryKey: tkeys.task(taskId), queryFn: () => fetchTask(taskId) })
  const sub = useQuery({ queryKey: tkeys.mySubmission(taskId), queryFn: () => fetchMySubmission(taskId) })
  // null = belum diubah → pakai nilai tersimpan di server.
  const [textDraft, setText] = useState(null)
  const [linkDraft, setLink] = useState(null)
  const [filesDraft, setFiles] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const fileRef = useRef(null)

  const text = textDraft ?? sub.data?.text_answer ?? ''
  const link = linkDraft ?? sub.data?.link_url ?? ''
  const files = filesDraft ?? sub.data?.files ?? []

  if (mine.isLoading || task.isLoading || sub.isLoading) return <Skeleton className="h-96 rounded-xl" />
  const row = mine.data?.find((t) => t.id === taskId)
  if (task.isError || !row) {
    return <Card><EmptyState icon={ClipboardList} title="Tugas tidak tersedia" description="Tugas belum diterbitkan atau bukan untuk kelasmu." action={<Link to="/siswa/tugas"><Button variant="outline">Kembali</Button></Link>} /></Card>
  }

  const t = task.data
  const status = studentTaskStatus(row)
  const types = t.submission_types
  const now = new Date()
  const closed = !t.allow_late && new Date(t.due_at) < now
  const notOpen = new Date(t.start_at) > now
  const submitted = sub.data?.status === 'submitted'
  const graded = row.score != null
  const editable = !submitted && !graded && !closed && !notOpen
  const acceptFiles = types.includes('file') || types.includes('image')
  const allowedExt = (settings.allowed_file_types ?? []).filter((e) => fileInfo(`x.${e}`) && (types.includes('file') || IMAGE_EXT.includes(e)))
  const fileItems = files.map((f) => ({ ...f, id: f.storage_path, title: f.file_name, bucket: TASK_BUCKET, type: f.type ?? fileInfo(f.file_name)?.type ?? 'file' }))

  const refresh = () => {
    sub.refetch()
    qc.invalidateQueries({ queryKey: tkeys.mine })
  }

  const persist = async (action, nextFiles = files) => {
    const res = await saveSubmission(taskId, action, { text: text.trim() || null, link: link.trim() || null, files: nextFiles })
    refresh()
    return res
  }

  const upload = async (list) => {
    if (!list?.length) return
    setUploading(true)
    let current = [...files]
    for (const original of list) {
      try {
        const ext = fileExt(original.name)
        if (!allowedExt.includes(ext)) throw new Error(`Jenis .${ext} tidak diterima untuk tugas ini.`)
        if (current.length >= 10) throw new Error('Maksimal 10 berkas.')
        const isImage = IMAGE_EXT.includes(ext)
        const file = isImage ? await compressImage(original) : original
        const limit = isImage ? settings.max_image_upload_mb : settings.max_upload_mb
        if (file.size > limit * 1024 * 1024) throw new Error(`${original.name}: ${formatBytes(file.size)} melebihi batas ${limit} MB.`)
        const meta = await uploadSubmissionFile({ task: t, studentId: profile.student_id, file })
        current = [...current, meta]
        setFiles(current)
      } catch (e) {
        toast.error(toMessage(e))
      }
    }
    try {
      await persist('save', current) // simpan sebagai draf agar berkas tidak "yatim"
      toast.success('Berkas diunggah dan draf tersimpan.')
    } catch (e) {
      toast.error(toMessage(e))
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeFile = async (f) => {
    const next = files.filter((x) => x.storage_path !== f.storage_path)
    try {
      await removeSubmissionFile(f.storage_path)
      setFiles(next)
      await persist('save', next)
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  const act = async (action) => {
    setBusy(true)
    try {
      const res = await persist(action)
      if (action === 'submit') toast.success(res.is_late ? 'Tugas terkumpul (terlambat).' : 'Tugas berhasil dikumpulkan! 🎉')
      else if (action === 'unsubmit') toast.success('Pengumpulan dibatalkan. Kamu bisa memperbaiki jawaban lalu mengumpulkan lagi.')
      else toast.success('Draf jawaban disimpan.')
      setConfirm(null)
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/siswa/tugas" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Tugas
      </Link>

      <header className="space-y-3">
        <p className="subject-color text-sm font-medium" style={{ '--subject-color': row.subject_color }}>{row.subject_name} · {row.teacher_name}</p>
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <TaskStatusBadge status={status} />
          <DueLabel dueAt={t.due_at} done={submitted || graded} />
          <span className="text-xs text-slate-500">Nilai maks. {Number(t.max_score)}</span>
        </div>
        {t.description && <p className="text-slate-600">{t.description}</p>}
      </header>

      {graded && (
        <Card className="border-violet-200 bg-violet-50/60">
          <CardBody className="flex gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white"><Star className="h-7 w-7" /></span>
            <div className="min-w-0">
              <p className="text-sm text-violet-700">Nilai dari guru</p>
              <p className="font-display text-3xl font-semibold text-violet-900">{Number(row.score)}<span className="text-lg text-violet-500"> / {Number(t.max_score)}</span></p>
              {row.feedback && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">“{row.feedback}”</p>}
            </div>
          </CardBody>
        </Card>
      )}

      <RichContent html={t.instructions_html} />
      {(t.attachments ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Paperclip className="h-5 w-5 text-slate-400" /> Lampiran dari guru</h2>
          <MaterialList materials={t.attachments.map((a) => ({ ...a, bucket: TASK_BUCKET }))} />
        </section>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold">Jawabanku</h2>
          {sub.data?.submitted_at && <span className="text-xs text-slate-500">Dikumpulkan {formatDate(sub.data.submitted_at, 'd MMM yyyy, HH:mm')}{sub.data.is_late ? ' (terlambat)' : ''}</span>}
        </div>
        <CardBody className="space-y-4">
          {notOpen && <Notice icon={Lock}>Tugas dibuka pada {formatDate(t.start_at, "d MMMM yyyy 'pukul' HH:mm")}.</Notice>}
          {closed && !submitted && !graded && <Notice icon={AlertTriangle} tone="red">Tenggat sudah lewat dan tugas ini tidak menerima pengumpulan terlambat.</Notice>}
          {!closed && t.allow_late && new Date(t.due_at) < now && !submitted && !graded && <Notice icon={AlertTriangle}>Tenggat sudah lewat. Kamu masih bisa mengumpulkan, tetapi akan ditandai terlambat.</Notice>}
          {submitted && !graded && <Notice icon={CheckCircle2} tone="green">Jawaban sudah dikumpulkan dan menunggu dinilai guru.</Notice>}

          {types.includes('text') && (
            <Textarea label="Jawaban teks" rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={!editable} placeholder="Tulis jawabanmu di sini…" maxLength={20000} />
          )}
          {types.includes('link') && (
            <Input label="Tautan hasil kerja" type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={!editable} placeholder="https://docs.google.com/…" hint="Pastikan tautan dapat dibuka oleh guru." />
          )}
          {acceptFiles && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{types.includes('file') ? 'Berkas jawaban' : 'Foto jawaban'}</p>
              {fileItems.length > 0 && (
                <ul className="space-y-2">
                  {fileItems.map((f) => (
                    <li key={f.storage_path} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1"><MaterialList materials={[f]} /></div>
                      {editable && (
                        <Button variant="ghost" size="icon-sm" onClick={() => removeFile(f)} aria-label={`Hapus ${f.file_name}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {editable && (
                <>
                  <Button variant="outline" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
                    {types.includes('image') && !types.includes('file') ? 'Unggah / ambil foto' : 'Unggah berkas'}
                  </Button>
                  <p className="text-xs text-slate-500">{allowedExt.map((e) => e.toUpperCase()).join(', ')} · foto dikompres otomatis · maks. 10 berkas</p>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={allowedExt.map((e) => `.${e}`).join(',')}
                    onChange={(e) => upload([...(e.target.files ?? [])])}
                  />
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            {editable && (
              <>
                <Button variant="outline" icon={Save} loading={busy && confirm === null} onClick={() => act('save')}>Simpan draf</Button>
                <Button icon={Send} disabled={uploading} onClick={() => setConfirm('submit')}>Kumpulkan</Button>
              </>
            )}
            {submitted && !graded && (
              <Button variant="ghost" icon={Undo2} onClick={() => setConfirm('unsubmit')}>Batalkan pengumpulan</Button>
            )}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => act(confirm)}
        loading={busy}
        tone="primary"
        title={confirm === 'submit' ? 'Kumpulkan tugas?' : 'Batalkan pengumpulan?'}
        confirmLabel={confirm === 'submit' ? 'Kumpulkan' : 'Batalkan pengumpulan'}
        message={
          confirm === 'submit'
            ? `Pastikan jawabanmu sudah lengkap.${new Date(t.due_at) < now ? ' Tenggat sudah lewat, jadi pengumpulan akan ditandai terlambat.' : ''}`
            : 'Jawaban kembali menjadi draf sehingga bisa diperbaiki. Jangan lupa mengumpulkan lagi sebelum tenggat.'
        }
      />
    </div>
  )
}

function Notice({ icon: Icon, tone = 'orange', children }) {
  const cls = { orange: 'border-accent-200 bg-accent-50 text-accent-800', red: 'border-red-200 bg-red-50 text-red-700', green: 'border-success-100 bg-success-50 text-success-700' }[tone]
  return (
    <div className={`flex gap-2 rounded-xl border p-3 text-sm ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}
