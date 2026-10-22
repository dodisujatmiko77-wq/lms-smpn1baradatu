import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { AlarmClock, CheckCircle2, CircleDashed, Clock, FileCheck2, PenLine, Star, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export const SUBMISSION_TYPES = [
  { value: 'text', label: 'Jawaban teks' },
  { value: 'file', label: 'Unggah dokumen' },
  { value: 'image', label: 'Unggah gambar/foto' },
  { value: 'link', label: 'Tautan hasil kerja' },
]

export const TASK_STATUS = {
  upcoming: { label: 'Belum dibuka', tone: 'slate', icon: Clock },
  todo: { label: 'Belum dikerjakan', tone: 'orange', icon: CircleDashed },
  draft: { label: 'Dikerjakan', tone: 'blue', icon: PenLine },
  submitted: { label: 'Terkumpul', tone: 'green', icon: CheckCircle2 },
  late: { label: 'Terlambat', tone: 'red', icon: AlarmClock },
  missing: { label: 'Lewat tenggat', tone: 'red', icon: XCircle },
  graded: { label: 'Sudah dinilai', tone: 'violet', icon: Star },
}

/** Status tugas dari sudut pandang siswa (baris get_my_assignments). */
export function studentTaskStatus(t, now = new Date()) {
  if (t.score != null) return 'graded'
  if (t.submission_status === 'submitted') return t.is_late ? 'late' : 'submitted'
  if (new Date(t.start_at) > now) return 'upcoming'
  if (t.submission_status === 'draft') return 'draft'
  return new Date(t.due_at) < now ? 'missing' : 'todo'
}

/** Status satu siswa di papan pemeriksaan guru. */
export function boardStatus(r, dueAt) {
  if (r.grade_id) return 'graded'
  if (r.submission_status === 'submitted') return r.is_late ? 'late' : 'submitted'
  if (new Date(dueAt) < new Date()) return 'missing'
  return r.submission_status === 'draft' ? 'draft' : 'todo'
}

export function TaskStatusBadge({ status }) {
  const s = TASK_STATUS[status]
  return <Badge tone={s.tone}><s.icon className="h-3 w-3" /> {s.label}</Badge>
}

/** "Tenggat 2 hari lagi" / "Lewat 3 jam" dengan warna sesuai kedekatan tenggat. */
export function DueLabel({ dueAt, done }) {
  const due = new Date(dueAt)
  const mins = differenceInMinutes(due, new Date())
  const rel = formatDistanceToNowStrict(due, { locale: localeId })
  const cls = done ? 'text-slate-500' : mins < 0 ? 'text-red-600' : mins < 24 * 60 ? 'text-accent-600' : 'text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`} title={formatDate(dueAt, "EEEE, d MMMM yyyy 'pukul' HH:mm")}>
      <FileCheck2 className="h-3.5 w-3.5" />
      {mins < 0 ? `Tenggat lewat ${rel}` : `Tenggat ${rel} lagi`} · {formatDate(dueAt, 'd MMM, HH:mm')}
    </span>
  )
}

/** Nilai input datetime-local (waktu lokal) ⇄ ISO. */
export const toLocalInput = (iso) => {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v) => new Date(v).toISOString()
