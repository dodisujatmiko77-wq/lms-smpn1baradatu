import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Circle, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, ConfirmDialog, ErrorState, Modal, SkeletonRows } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { cn, formatDate } from '@/lib/utils'
import { fetchAttemptDetail, gradeEssay, qkeys, resetAttempt } from '../api'
import { QuestionMeta } from './QuestionCard'
import { fmtScore, toHundred } from '../status'

function EssayGrader({ attemptId, q, onGraded }) {
  const [score, setScore] = useState(q.score == null ? '' : String(Number(q.score)))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const n = Number(score)
    if (score === '' || !(n >= 0 && n <= Number(q.points))) return toast.error(`Nilai harus antara 0 dan ${fmtScore(q.points)}.`)
    setSaving(true)
    try {
      await gradeEssay(attemptId, q.id, n)
      toast.success('Nilai esai disimpan.')
      onGraded()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-50/60 p-3">
      <label className="text-sm font-medium text-slate-700" htmlFor={`essay-${q.id}`}>Nilai esai</label>
      <input id={`essay-${q.id}`} type="number" min={0} max={Number(q.points)} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm focus:border-primary-500 focus:outline-none" />
      <span className="text-sm text-slate-500">/ {fmtScore(q.points)}</span>
      <Button size="sm" loading={saving} onClick={save}>Simpan nilai</Button>
    </div>
  )
}

function AnswerView({ q }) {
  if (q.type === 'mcq') {
    return (
      <ul className="space-y-1">
        {q.options.map((o, i) => {
          const mine = o.id === q.my_option_id
          return (
            <li key={o.id} className={cn('flex items-start gap-2 rounded-lg px-2 py-1 text-sm', mine && (o.is_correct ? 'bg-success-50' : 'bg-red-50'), o.is_correct ? 'font-medium text-success-700' : 'text-slate-600')}>
              {o.is_correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : mine ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
              <span>{String.fromCharCode(65 + i)}. {o.body}{mine && <span className="ml-1 text-xs font-semibold">(jawaban siswa)</span>}</span>
            </li>
          )
        })}
      </ul>
    )
  }
  const text = q.type === 'true_false' ? ({ true: 'Benar', false: 'Salah' })[q.my_text] : q.my_text
  return (
    <div className="space-y-1.5 text-sm">
      <p className={cn('whitespace-pre-line rounded-lg px-3 py-2', text ? 'bg-slate-50 text-slate-800' : 'italic text-slate-500')}>{text || 'Tidak dijawab'}</p>
      {q.type !== 'essay' && <p className="text-success-700"><span className="font-medium">Kunci:</span> {q.type === 'true_false' ? (q.answer_key === 'true' ? 'Benar' : 'Salah') : q.answer_key?.split(/\n|\|/).filter(Boolean).join(' · ')}</p>}
      {q.type === 'essay' && q.answer_key && <p className="text-slate-500"><span className="font-medium">Pedoman:</span> {q.answer_key}</p>}
    </div>
  )
}

/** Detail jawaban satu siswa (percobaan terakhir) untuk guru/wali kelas. */
export function AttemptDetailModal({ row, quiz, canManage, onClose, onChanged }) {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: qkeys.attemptDetail(row.last_attempt_id), queryFn: () => fetchAttemptDetail(row.last_attempt_id) })
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const graded = () => {
    refetch()
    onChanged()
  }
  const doReset = async () => {
    setBusy(true)
    try {
      await resetAttempt(row.last_attempt_id)
      toast.success('Percobaan dihapus. Siswa dapat mengerjakan ulang selama kuis masih dibuka.')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={row.full_name} description={`${quiz.title} · percobaan ke-${data?.attempt_no ?? row.attempts}`}>
      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm">
            {data.status === 'submitted' ? (
              <>
                <span className="font-display text-2xl font-semibold text-slate-900">{fmtScore(toHundred(data.score_total, data.max_score))}</span>
                <span className="text-slate-500">({fmtScore(data.score_total)}/{fmtScore(data.max_score)} poin)</span>
                {data.needs_manual && <Badge tone="orange">Esai belum dinilai — nilai sementara</Badge>}
              </>
            ) : (
              <Badge tone="blue" dot>Sedang mengerjakan</Badge>
            )}
            <span className="ml-auto text-xs text-slate-500">
              Mulai {formatDate(data.started_at, 'd MMM HH:mm')}{data.submitted_at && ` · selesai ${formatDate(data.submitted_at, 'HH:mm')}`}{data.auto_submitted && ' (otomatis)'}
            </span>
          </div>
          {data.focus_lost_count > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-accent-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Siswa meninggalkan halaman ujian {data.focus_lost_count}× (pindah aplikasi/tab). Ini informasi, bukan bukti kecurangan.
            </p>
          )}
          <ol className="space-y-4">
            {data.questions.map((q, i) => (
              <li key={q.id} className="space-y-2 rounded-xl border border-slate-200/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                    <QuestionMeta question={q} points={q.points} />
                  </div>
                  {data.status === 'submitted' && q.type !== 'essay' && (
                    <span className={cn('text-sm font-semibold', q.is_correct ? 'text-success-700' : 'text-red-600')}>{fmtScore(q.score ?? 0)}/{fmtScore(q.points)}</span>
                  )}
                  {data.status === 'submitted' && q.type === 'essay' && q.score != null && <span className="text-sm font-semibold text-violet-700">{fmtScore(q.score)}/{fmtScore(q.points)}</span>}
                </div>
                <p className="whitespace-pre-line text-[15px] text-slate-900">{q.body}</p>
                <AnswerView q={q} />
                {canManage && data.status === 'submitted' && q.type === 'essay' && (q.my_text?.trim() ? <EssayGrader attemptId={data.id} q={q} onGraded={graded} /> : <p className="text-xs text-slate-500">Esai kosong otomatis bernilai 0.</p>)}
              </li>
            ))}
          </ol>
          {canManage && (
            <div className="border-t border-slate-100 pt-4">
              <Button variant="ghost" size="sm" icon={RotateCcw} className="-ml-2 text-red-600 hover:bg-red-50" onClick={() => setConfirmReset(true)}>Izinkan mengulang (hapus percobaan ini)</Button>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        loading={busy}
        onConfirm={doReset}
        title="Hapus percobaan siswa?"
        confirmLabel="Hapus & izinkan mengulang"
        message={`Jawaban dan nilai percobaan ini dihapus permanen sehingga ${row.full_name} mendapat kesempatan lagi (mis. karena kendala jaringan/HP). Tindakan ini tercatat di Audit Log.`}
      />
    </Modal>
  )
}
