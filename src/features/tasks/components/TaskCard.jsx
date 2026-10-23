import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DueLabel, TaskStatusBadge, studentTaskStatus } from '../status'

/** Kartu tugas untuk siswa. */
export function TaskCard({ task, showSubject = true }) {
  const status = studentTaskStatus(task)
  const done = ['submitted', 'late', 'graded'].includes(status)
  return (
    <Link to={`/siswa/tugas/${task.id}`} className="group flex items-center gap-4 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.subject_color }} />
      <div className="min-w-0 flex-1 space-y-1">
        {showSubject && <p className="subject-color text-xs font-medium" style={{ '--subject-color': task.subject_color }}>{task.subject_name}</p>}
        <p className="font-semibold leading-snug text-slate-900">{task.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={status} />
          {status === 'graded' ? (
            <span className="text-sm font-semibold text-violet-700">Nilai {Number(task.score)}/{Number(task.max_score)}</span>
          ) : (
            <DueLabel dueAt={task.due_at} done={done} />
          )}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5" />
    </Link>
  )
}
