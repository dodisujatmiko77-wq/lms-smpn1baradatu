import { Link } from 'react-router-dom'
import { ChevronRight, ListOrdered, Timer } from 'lucide-react'
import { KIND_LABEL, QuizStatusBadge, fmtScore, studentQuizStatus, windowLabel } from '../status'

/** Kartu kuis untuk siswa. */
export function QuizCard({ quiz, showSubject = true }) {
  const status = studentQuizStatus(quiz)
  return (
    <Link to={`/siswa/kuis/${quiz.id}`} className="group flex items-center gap-4 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: quiz.subject_color }} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium" style={{ color: quiz.subject_color }}>
          {KIND_LABEL[quiz.kind]}{showSubject && ` · ${quiz.subject_name}`}
        </p>
        <p className="font-semibold leading-snug text-slate-900">{quiz.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{windowLabel(quiz.open_at, quiz.close_at)}</span>
          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {quiz.duration_minutes} menit</span>
          <span className="flex items-center gap-1"><ListOrdered className="h-3 w-3" /> {quiz.question_count} soal</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <QuizStatusBadge status={status} />
          {quiz.best_score != null && <span className="text-sm font-semibold text-violet-700">Nilai {fmtScore(quiz.best_score)}/{fmtScore(quiz.max_score)}</span>}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5" />
    </Link>
  )
}
