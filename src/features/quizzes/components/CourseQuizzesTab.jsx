import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileQuestion, Plus, Timer } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { PublishBadge } from '@/features/classroom/components/status'
import { fetchCourseQuizzes, qkeys } from '../api'
import { KIND_LABEL, fmtScore, windowLabel } from '../status'
import { NewQuizModal } from './NewQuizModal'

/** Tab "Kuis" di ruang kelas guru. */
export function CourseQuizzesTab({ course }) {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: qkeys.course(course.id), queryFn: () => fetchCourseQuizzes(course.id) })
  const [open, setOpen] = useState(false)
  const rows = data ?? []
  const now = new Date()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{rows.length}</span> kuis & ujian</p>
        <div className="flex gap-2">
          <Link to="/guru/bank-soal"><Button variant="outline" icon={FileQuestion}>Bank soal</Button></Link>
          <Button icon={Plus} onClick={() => setOpen(true)}>Buat kuis</Button>
        </div>
      </div>
      <Card>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FileQuestion} title="Belum ada kuis" description="Susun soal di Bank Soal, lalu buat kuis atau ujian dengan jadwal dan durasi. Soal objektif dinilai otomatis." action={<Button icon={Plus} onClick={() => setOpen(true)}>Buat kuis</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((q) => {
              const live = q.status === 'published' && now >= new Date(q.open_at) && now < new Date(q.close_at)
              return (
                <li key={q.id}>
                  <Link to={`/guru/kelas/${course.id}/kuis/${q.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><FileQuestion className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-medium text-slate-900">
                        <span className="mr-1.5 text-xs font-semibold uppercase text-violet-600">{KIND_LABEL[q.kind]}</span>
                        {q.title}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{windowLabel(q.open_at, q.close_at)}</span>
                        <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {q.duration_minutes} menit</span>
                        <span>{q.question_count} soal · {fmtScore(q.max_score)} poin</span>
                      </p>
                      {q.status === 'published' && (
                        <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                          <span>{q.participants}/{q.student_count} mengerjakan</span>
                          {q.in_progress > 0 && <span className="text-primary-600">{q.in_progress} sedang mengerjakan</span>}
                          {q.avg_score != null && <span>rata-rata {fmtScore(q.avg_score)}</span>}
                        </p>
                      )}
                    </div>
                    {live && <Badge tone="green" dot>Berlangsung</Badge>}
                    {q.needs_manual > 0 && <Badge tone="orange">{q.needs_manual} esai perlu dinilai</Badge>}
                    <PublishBadge status={q.status} />
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <NewQuizModal key={String(open)} open={open} taId={course.id} onClose={() => setOpen(false)} onCreated={refetch} />
    </div>
  )
}
