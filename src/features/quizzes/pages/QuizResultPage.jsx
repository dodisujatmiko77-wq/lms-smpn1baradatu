import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Circle, EyeOff, Hourglass, PartyPopper, XCircle } from 'lucide-react'
import { Badge, Button, Card, CardBody, ErrorState, Skeleton } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { fetchAttemptResult, qkeys } from '../api'
import { QuestionTypeBadge, fmtScore, toHundred } from '../status'

function ScoreRing({ value }) {
  const size = 112
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = value >= 75 ? '#16a34a' : value >= 50 ? '#f59e0b' : '#dc2626'
  return (
    <div className="relative grid shrink-0 place-items-center" role="img" aria-label={`Nilai ${fmtScore(value)} dari 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (Math.min(100, value) / 100) * c} />
      </svg>
      <span className="absolute text-center">
        <span className="block font-display text-3xl font-semibold leading-none text-slate-900">{fmtScore(value)}</span>
        <span className="text-[11px] text-slate-500">dari 100</span>
      </span>
    </div>
  )
}

function ReviewItem({ q, index }) {
  const essay = q.type === 'essay'
  const unanswered = !q.my_option_id && !(q.my_text ?? '').trim()
  return (
    <li className="space-y-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
          <QuestionTypeBadge type={q.type} />
        </div>
        {essay ? (
          q.score != null ? <span className="text-sm font-semibold text-violet-700">{fmtScore(q.score)}/{fmtScore(q.points)}</span> : !unanswered && <Badge tone="violet">Dinilai guru</Badge>
        ) : q.is_correct ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-success-700"><CheckCircle2 className="h-4 w-4" /> Benar</span>
        ) : (
          <span className="flex items-center gap-1 text-sm font-semibold text-red-600"><XCircle className="h-4 w-4" /> {unanswered ? 'Tidak dijawab' : 'Salah'}</span>
        )}
      </div>
      <p className="whitespace-pre-line text-[15px] text-slate-900">{q.body}</p>
      {q.type === 'mcq' ? (
        <ul className="space-y-1.5">
          {q.options.map((o, i) => {
            const mine = o.id === q.my_option_id
            return (
              <li key={o.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', o.is_correct ? 'border-success-200 bg-success-50 text-success-800' : mine ? 'border-red-200 bg-red-50 text-red-800' : 'border-transparent text-slate-600')}>
                {o.is_correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : mine ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                <span className="flex-1">{String.fromCharCode(65 + i)}. {o.body}</span>
                {mine && <span className="text-xs font-semibold">Jawabanmu</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className={cn('whitespace-pre-line rounded-lg px-3 py-2', unanswered ? 'italic text-slate-400' : 'bg-slate-50 text-slate-800')}>
            <span className="mr-1 text-xs font-semibold not-italic text-slate-500">Jawabanmu:</span>
            {unanswered ? 'tidak dijawab' : q.type === 'true_false' ? (q.my_text === 'true' ? 'Benar' : 'Salah') : q.my_text}
          </p>
          {q.answer_key && (
            <p className="text-success-700">
              <span className="font-medium">Kunci:</span> {q.type === 'true_false' ? (q.answer_key === 'true' ? 'Benar' : 'Salah') : q.answer_key.split(/\n|\|/).map((k) => k.trim()).filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
      {q.explanation && <p className="rounded-lg bg-primary-50/60 px-3 py-2 text-sm text-slate-700"><span className="font-semibold text-primary-700">Pembahasan:</span> {q.explanation}</p>}
    </li>
  )
}

/** Hasil satu percobaan + pembahasan (bila diizinkan guru). */
export default function QuizResultPage() {
  const { quizId, attemptId } = useParams()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: qkeys.result(attemptId), queryFn: () => fetchAttemptResult(attemptId) })

  if (isLoading) return <Skeleton className="mx-auto h-80 max-w-3xl rounded-xl" />
  if (isError) return <Card className="mx-auto max-w-3xl"><ErrorState error={error} onRetry={refetch} /></Card>
  const r = data
  const pct = toHundred(r.score_total, r.max_score)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to={`/siswa/kuis/${quizId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {r.title}
      </Link>
      <Card>
        <CardBody className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {r.show_score && pct != null ? (
            <ScoreRing value={pct} />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-success-50 text-success-600"><PartyPopper className="h-9 w-9" /></span>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xl font-semibold">Jawaban terkumpul</h2>
            <p className="text-sm text-slate-600">
              Percobaan ke-{r.attempt_no} · {formatDate(r.submitted_at, "d MMMM yyyy 'pukul' HH:mm")}
              {r.auto_submitted && ' · dikumpulkan otomatis karena waktu habis'}
            </p>
            <p className="text-sm text-slate-600">{r.answered} dari {r.total} soal dijawab{r.show_score && r.score_total != null && ` · skor ${fmtScore(r.score_total)}/${fmtScore(r.max_score)}`}</p>
            {r.needs_manual && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-violet-700 sm:justify-start"><Hourglass className="h-4 w-4" /> Jawaban esai sedang dinilai guru{r.show_score && ' — nilai di atas masih sementara'}.</p>
            )}
          </div>
        </CardBody>
      </Card>

      {r.review_available ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pembahasan</h3>
          <ol className="space-y-3">{r.review.map((q, i) => <ReviewItem key={q.id} q={q} index={i} />)}</ol>
        </section>
      ) : (
        <Card>
          <CardBody className="flex items-start gap-3 text-sm text-slate-600">
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            {r.review_mode === 'after_close'
              ? `Kunci jawaban dan pembahasan dapat dilihat setelah kuis ditutup (${formatDate(r.close_at, "d MMM yyyy 'pukul' HH:mm")}).`
              : 'Guru tidak menampilkan kunci jawaban untuk kuis ini.'}
          </CardBody>
        </Card>
      )}
      <div className="text-center">
        <Link to="/siswa/kuis"><Button variant="outline">Kembali ke daftar kuis</Button></Link>
      </div>
    </div>
  )
}
