import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, BookOpenCheck, CalendarClock, ChevronRight, ListOrdered, PlayCircle, RotateCcw, Timer, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { fetchMyAttempts, fetchMyQuizzes, qkeys, startAttempt } from '../api'
import { KIND_LABEL, QuizStatusBadge, fmtScore, studentQuizStatus, windowLabel } from '../status'

/** Halaman pembuka kuis: info, aturan, mulai/lanjutkan, riwayat percobaan. */
export default function QuizStartPage() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const quizzes = useQuery({ queryKey: qkeys.mine, queryFn: fetchMyQuizzes })
  const attempts = useQuery({ queryKey: qkeys.myAttempts(quizId), queryFn: () => fetchMyAttempts(quizId) })
  const [confirm, setConfirm] = useState(false)
  const [starting, setStarting] = useState(false)

  if (quizzes.isLoading) return <Skeleton className="h-80 rounded-xl" />
  if (quizzes.isError) return <Card><ErrorState error={quizzes.error} onRetry={quizzes.refetch} /></Card>
  const q = quizzes.data.find((x) => x.id === quizId)
  if (!q) return <Card><EmptyState icon={BookOpenCheck} title="Kuis tidak ditemukan" description="Kuis ini tidak tersedia untuk kelasmu." /></Card>

  const status = studentQuizStatus(q)
  const history = (attempts.data ?? []).filter((a) => a.status === 'submitted')
  const remaining = q.max_attempts - q.attempts_used

  const start = async () => {
    setStarting(true)
    try {
      const id = await startAttempt(quizId)
      qc.invalidateQueries({ queryKey: qkeys.mine })
      navigate(`/siswa/kuis/${quizId}/kerjakan/${id}`)
    } catch (e) {
      toast.error(toMessage(e))
      quizzes.refetch()
      setStarting(false)
      setConfirm(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/siswa/kuis" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Kuis & Ujian
      </Link>
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-card" style={{ background: `linear-gradient(135deg, ${q.subject_color}, ${q.subject_color}cc 60%, #1e3a8a)` }}>
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <p className="relative text-sm font-medium text-white/85">{KIND_LABEL[q.kind]} · {q.subject_name} · {q.teacher_name}</p>
        <h2 className="relative mt-1 font-display text-2xl font-semibold text-white">{q.title}</h2>
        <div className="relative mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-white/15 p-3"><Timer className="mb-1 h-4 w-4" />{q.duration_minutes} menit</div>
          <div className="rounded-xl bg-white/15 p-3"><ListOrdered className="mb-1 h-4 w-4" />{q.question_count} soal</div>
          <div className="rounded-xl bg-white/15 p-3"><RotateCcw className="mb-1 h-4 w-4" />{q.attempts_used}/{q.max_attempts} percobaan</div>
        </div>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <QuizStatusBadge status={status} />
            <span className="flex items-center gap-1.5 text-sm text-slate-600"><CalendarClock className="h-4 w-4" /> {windowLabel(q.open_at, q.close_at)}</span>
          </div>
          {q.description && <p className="whitespace-pre-line text-sm text-slate-700">{q.description}</p>}
          <ul className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <li className="flex gap-2"><Timer className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" /> Waktu berjalan sejak kamu menekan <b>Mulai</b> dan tidak berhenti walau HP dikunci atau aplikasi ditutup.</li>
            <li className="flex gap-2"><Wifi className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" /> Jawaban tersimpan otomatis. Jika koneksi terputus, buka lagi halaman ini lalu tekan <b>Lanjutkan</b>.</li>
            <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" /> Berpindah ke aplikasi/tab lain selama mengerjakan akan dicatat dan dilaporkan ke guru.</li>
          </ul>
          {status === 'in_progress' ? (
            <Button size="lg" icon={PlayCircle} className="w-full" onClick={() => navigate(`/siswa/kuis/${quizId}/kerjakan/${q.in_progress_attempt_id}`)}>Lanjutkan mengerjakan</Button>
          ) : status === 'open' ? (
            <Button size="lg" icon={PlayCircle} className="w-full" onClick={() => setConfirm(true)}>{q.attempts_used ? `Kerjakan lagi (sisa ${remaining} kesempatan)` : 'Mulai mengerjakan'}</Button>
          ) : status === 'upcoming' ? (
            <p className="rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-600">Kuis dibuka <b>{formatDate(q.open_at, "EEEE, d MMMM 'pukul' HH:mm")}</b>.</p>
          ) : status === 'missed' ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">Kuis sudah ditutup dan kamu tidak mengerjakannya.</p>
          ) : null}
        </CardBody>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader title="Riwayat pengerjaan" description={q.show_score ? 'Nilai yang dipakai adalah nilai tertinggi.' : 'Guru tidak menampilkan nilai untuk kuis ini.'} />
          <ul className="divide-y divide-slate-100">
            {history.map((a) => (
              <li key={a.id}>
                <Link to={`/siswa/kuis/${quizId}/hasil/${a.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{a.attempt_no}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">Percobaan ke-{a.attempt_no}</p>
                    <p className="text-xs text-slate-500">{formatDate(a.submitted_at, 'd MMM yyyy, HH:mm')}{a.auto_submitted && ' · dikumpulkan otomatis (waktu habis)'}</p>
                  </div>
                  {a.needs_manual && <Badge tone="violet">Esai sedang dinilai</Badge>}
                  {a.score_total != null && <span className="font-semibold text-violet-700">{fmtScore(a.score_total)}/{fmtScore(a.max_score)}</span>}
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={start}
        loading={starting}
        tone="primary"
        title="Mulai sekarang?"
        confirmLabel="Mulai"
        message={`Waktu ${q.duration_minutes} menit akan langsung berjalan. Pastikan koneksi internet dan baterai HP cukup.`}
      />
    </div>
  )
}
