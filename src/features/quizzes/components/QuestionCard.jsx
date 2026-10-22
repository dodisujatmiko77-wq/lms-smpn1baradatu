import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QuestionTypeBadge, fmtScore } from '../status'

/** Tampilan soal untuk guru (dengan kunci jawaban). */
export function QuestionView({ question, compact = false }) {
  const q = question
  return (
    <div className="min-w-0 space-y-2">
      <p className={cn('whitespace-pre-line text-slate-900', compact ? 'line-clamp-2 text-sm' : 'text-[15px]')}>{q.body}</p>
      {!compact && q.type === 'mcq' && (
        <ul className="space-y-1">
          {q.options.map((o, i) => (
            <li key={o.id ?? i} className={cn('flex items-start gap-2 text-sm', o.is_correct ? 'font-medium text-success-700' : 'text-slate-600')}>
              {o.is_correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
              <span>{String.fromCharCode(65 + i)}. {o.body}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && q.type === 'true_false' && (
        <p className="text-sm font-medium text-success-700">Kunci: {q.answer_key === 'true' ? 'Benar' : 'Salah'}</p>
      )}
      {!compact && q.type === 'short' && (
        <p className="text-sm text-success-700"><span className="font-medium">Kunci:</span> {q.answer_key.split(/\n|\|/).map((k) => k.trim()).filter(Boolean).join(' · ')}</p>
      )}
      {!compact && q.type === 'essay' && q.answer_key && <p className="text-sm text-slate-500"><span className="font-medium">Pedoman:</span> {q.answer_key}</p>}
      {!compact && q.explanation && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="font-semibold">Pembahasan:</span> {q.explanation}</p>}
    </div>
  )
}

export function QuestionMeta({ question, points }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuestionTypeBadge type={question.type} />
      <span className="text-xs font-medium text-slate-500">{fmtScore(points ?? question.points)} poin</span>
    </div>
  )
}
