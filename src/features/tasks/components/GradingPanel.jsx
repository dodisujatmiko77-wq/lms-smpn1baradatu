import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Inbox, Save, Send, SkipForward, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, SkeletonRows, Tabs, Textarea } from '@/components/ui'
import { inputClass } from '@/components/ui/Input'
import { MaterialList } from '@/features/classroom/components/materials'
import { toMessage } from '@/lib/errors'
import { cn, formatDate } from '@/lib/utils'
import { TASK_BUCKET, fetchBoard, publishGrades, saveGrade, tkeys } from '../api'
import { TaskStatusBadge, boardStatus } from '../status'

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Perlu dinilai' },
  { value: 'missing', label: 'Belum mengumpulkan' },
  { value: 'graded', label: 'Sudah dinilai' },
]

function GradeForm({ task, row, onSaved, onNext }) {
  const [score, setScore] = useState(row.score ?? '')
  const [feedback, setFeedback] = useState(row.feedback ?? '')
  const [saving, setSaving] = useState(false)
  const max = Number(task.max_score)

  const save = async (next) => {
    const n = Number(String(score).replace(',', '.'))
    if (score === '' || Number.isNaN(n) || n < 0 || n > max) return toast.error(`Nilai harus antara 0 dan ${max}.`)
    setSaving(true)
    try {
      await saveGrade({ assignmentId: task.id, studentId: row.student_id, score: n, feedback: feedback.trim() })
      toast.success(`Nilai ${row.full_name} disimpan${row.published_at ? ' (sudah terbit — siswa melihat nilai terbaru)' : ''}.`)
      onSaved()
      if (next) onNext()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 p-5">
      <div className="flex items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-700">Nilai</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step="0.5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className={cn(inputClass(false), 'h-12 w-28 pr-3 text-lg font-semibold')}
              aria-label="Nilai"
            />
            <span className="text-sm text-slate-500">/ {max}</span>
          </span>
        </label>
        <div className="ml-auto text-right text-xs text-slate-500">
          {row.graded_at && <p>Dinilai {formatDate(row.graded_at, 'd MMM, HH:mm')}</p>}
          {row.published_at ? <Badge tone="green">Terbit ke siswa</Badge> : row.grade_id ? <Badge tone="orange">Belum terbit</Badge> : null}
        </div>
      </div>
      <Textarea label="Umpan balik untuk siswa" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Apa yang sudah baik dan apa yang perlu diperbaiki?" />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" icon={Save} loading={saving} onClick={() => save(false)}>Simpan</Button>
        <Button icon={SkipForward} loading={saving} onClick={() => save(true)}>Simpan & berikutnya</Button>
      </div>
    </div>
  )
}

/** Papan pemeriksaan: daftar siswa + isi jawaban + nilai & umpan balik. */
export function GradingPanel({ task, canManage }) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: tkeys.board(task.id), queryFn: () => fetchBoard(task.id) })
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const rows = useMemo(() => (data ?? []).map((r) => ({ ...r, status: boardStatus(r, task.due_at) })), [data, task.due_at])
  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'pending' ? ['submitted', 'late'].includes(r.status) : filter === 'missing' ? ['missing', 'todo', 'draft'].includes(r.status) : r.status === 'graded',
  )
  const selected = rows.find((r) => r.student_id === selectedId) ?? visible[0] ?? null
  const unpublished = rows.filter((r) => r.grade_id && !r.published_at).length
  const counts = {
    submitted: rows.filter((r) => r.submission_status === 'submitted').length,
    pending: rows.filter((r) => ['submitted', 'late'].includes(r.status)).length,
    graded: rows.filter((r) => r.grade_id).length,
  }

  const refresh = () => {
    refetch()
    qc.invalidateQueries({ queryKey: tkeys.course(task.teaching_assignment_id) })
    qc.invalidateQueries({ queryKey: tkeys.queue })
  }
  const next = () => {
    const i = visible.findIndex((r) => r.student_id === selected?.student_id)
    const n = visible[i + 1]
    if (n) setSelectedId(n.student_id)
  }

  const doPublish = async () => {
    setPublishing(true)
    try {
      const n = await publishGrades(task.id)
      toast.success(`${n} nilai diterbitkan. Siswa kini dapat melihat nilai dan umpan baliknya.`)
      setPublishOpen(false)
      refresh()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setPublishing(false)
    }
  }

  if (isLoading) return <Card><SkeletonRows rows={6} /></Card>
  if (isError) return <Card><ErrorState error={error} onRetry={refetch} /></Card>
  if (rows.length === 0) return <Card><EmptyState icon={Users} title="Belum ada siswa di kelas ini" /></Card>

  const files = (selected?.files ?? []).map((f, i) => ({ ...f, id: f.storage_path ?? i, title: f.file_name, bucket: TASK_BUCKET, type: f.type ?? 'file' }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <b className="text-slate-900">{counts.submitted}</b>/{rows.length} terkumpul · <b className="text-slate-900">{counts.pending}</b> perlu dinilai · {counts.graded} dinilai
        </p>
        {canManage && (
          <Button icon={Send} variant="success" disabled={unpublished === 0} onClick={() => setPublishOpen(true)}>
            Terbitkan nilai{unpublished ? ` (${unpublished})` : ''}
          </Button>
        )}
      </div>
      <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          {visible.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={filter === 'pending' ? 'Semua jawaban sudah dinilai 🎉' : 'Tidak ada siswa'}
              description={filter === 'pending' && unpublished ? 'Jangan lupa menekan "Terbitkan nilai".' : undefined}
              className="py-8"
            />
          ) : (
            <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
              {visible.map((r) => (
                <li key={r.student_id}>
                  <button
                    onClick={() => setSelectedId(r.student_id)}
                    className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50', selected?.student_id === r.student_id && 'bg-primary-50/70')}
                  >
                    <Avatar name={r.full_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{r.full_name}</span>
                      <TaskStatusBadge status={r.status} />
                    </span>
                    {r.score != null && <span className="text-sm font-semibold text-slate-900">{Number(r.score)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <Avatar name={selected.full_name} />
                <div>
                  <p className="font-semibold text-slate-900">{selected.full_name}</p>
                  <p className="text-xs text-slate-500">NISN {selected.nisn}</p>
                </div>
              </div>
              <div className="text-right">
                <TaskStatusBadge status={selected.status} />
                {selected.submitted_at && <p className="mt-1 text-xs text-slate-500">Dikumpulkan {formatDate(selected.submitted_at, "d MMM yyyy, HH:mm")}</p>}
              </div>
            </div>
            <div className="space-y-4 px-5 pb-5">
              {selected.submission_status !== 'submitted' ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  {selected.submission_status === 'draft' ? 'Siswa sudah mulai mengerjakan tetapi belum mengumpulkan.' : 'Siswa belum mengumpulkan tugas ini.'} Anda tetap dapat memberi nilai (misalnya 0).
                </p>
              ) : (
                <>
                  {selected.text_answer && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Jawaban</p>
                      <div className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{selected.text_answer}</div>
                    </div>
                  )}
                  {selected.link_url && (
                    <a href={selected.link_url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-primary-700 hover:bg-primary-50">
                      <ExternalLink className="h-4 w-4" /> <span className="truncate">{selected.link_url}</span>
                    </a>
                  )}
                  {files.length > 0 && <MaterialList materials={files} />}
                </>
              )}
            </div>
            {canManage ? (
              <GradeForm key={selected.student_id + (selected.graded_at ?? '')} task={task} row={selected} onSaved={refresh} onNext={next} />
            ) : (
              selected.score != null && (
                <div className="border-t border-slate-100 p-5 text-sm">
                  Nilai: <b>{Number(selected.score)}</b> / {Number(task.max_score)}
                  {selected.feedback && <p className="mt-2 text-slate-600">{selected.feedback}</p>}
                </div>
              )
            )}
          </Card>
        )}
      </div>
      <ConfirmDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onConfirm={doPublish}
        loading={publishing}
        tone="primary"
        title="Terbitkan nilai?"
        confirmLabel="Terbitkan"
        message={`${unpublished} nilai beserta umpan baliknya akan terlihat oleh siswa. Pengumpulan yang sudah dinilai dan terbit akan terkunci.`}
      />
    </div>
  )
}
