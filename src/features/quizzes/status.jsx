import { CheckCircle2, CircleDot, Clock, Hourglass, ListChecks, PenLine, PlayCircle, ToggleLeft, Type, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export const QUESTION_TYPES = {
  mcq: { label: 'Pilihan ganda', short: 'PG', icon: ListChecks, tone: 'blue' },
  true_false: { label: 'Benar / Salah', short: 'B/S', icon: ToggleLeft, tone: 'violet' },
  short: { label: 'Isian singkat', short: 'Isian', icon: Type, tone: 'green' },
  essay: { label: 'Esai / Uraian', short: 'Esai', icon: PenLine, tone: 'orange' },
}

export const REVIEW_MODES = [
  { value: 'after_submit', label: 'Setelah siswa mengumpulkan' },
  { value: 'after_close', label: 'Setelah kuis ditutup' },
  { value: 'never', label: 'Tidak ditampilkan' },
]

export const KIND_LABEL = { quiz: 'Kuis', exam: 'Ujian' }

export function QuestionTypeBadge({ type }) {
  const t = QUESTION_TYPES[type]
  return <Badge tone={t.tone}><t.icon className="h-3 w-3" /> {t.label}</Badge>
}

export const num = (v) => (v == null ? null : Number(v))
export const fmtScore = (v) => (v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }))

/** Nilai skala 100 dari skor mentah. */
export const toHundred = (score, max) => (score == null || !Number(max) ? null : Math.round((Number(score) / Number(max)) * 1000) / 10)

export const QUIZ_STATUS = {
  upcoming: { label: 'Belum dibuka', tone: 'slate', icon: Clock },
  open: { label: 'Bisa dikerjakan', tone: 'orange', icon: PlayCircle },
  in_progress: { label: 'Sedang dikerjakan', tone: 'blue', icon: CircleDot },
  waiting: { label: 'Menunggu penilaian', tone: 'violet', icon: Hourglass },
  done: { label: 'Selesai', tone: 'green', icon: CheckCircle2 },
  missed: { label: 'Tidak dikerjakan', tone: 'red', icon: XCircle },
}

/** Status kuis dari sudut pandang siswa (baris get_my_quizzes). */
export function studentQuizStatus(q, now = new Date()) {
  if (q.in_progress_attempt_id) return 'in_progress'
  const open = now >= new Date(q.open_at) && now < new Date(q.close_at)
  if (now < new Date(q.open_at)) return 'upcoming'
  if (open && q.attempts_used < q.max_attempts) return 'open'
  if (q.attempts_used === 0) return 'missed'
  return q.needs_manual ? 'waiting' : 'done'
}

export function QuizStatusBadge({ status }) {
  const s = QUIZ_STATUS[status]
  return <Badge tone={s.tone}><s.icon className="h-3 w-3" /> {s.label}</Badge>
}

/** "Dibuka 12 Okt 07.00 – 12 Okt 09.00" */
export function windowLabel(openAt, closeAt) {
  const sameDay = formatDate(openAt, 'yyyyMMdd') === formatDate(closeAt, 'yyyyMMdd')
  return `${formatDate(openAt, 'EEE, d MMM HH:mm')} – ${formatDate(closeAt, sameDay ? 'HH:mm' : 'EEE, d MMM HH:mm')}`
}

/** mm:ss atau j:mm:ss */
export function formatClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}
