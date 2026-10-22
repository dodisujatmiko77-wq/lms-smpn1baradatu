import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { PublishBadge } from '@/features/classroom/components/status'
import { fetchCourseTasks, tkeys } from '../api'
import { DueLabel } from '../status'
import { NewTaskModal } from './NewTaskModal'

/** Tab "Tugas" di ruang kelas guru. */
export function CourseTasksTab({ course }) {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: tkeys.course(course.id), queryFn: () => fetchCourseTasks(course.id) })
  const [open, setOpen] = useState(false)
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{rows.length}</span> tugas</p>
        <Button icon={Plus} onClick={() => setOpen(true)}>Buat tugas</Button>
      </div>
      <Card>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Belum ada tugas" description="Buat tugas dengan instruksi, lampiran, dan tenggat. Siswa dapat mengumpulkan teks, dokumen, foto, atau tautan." action={<Button icon={Plus} onClick={() => setOpen(true)}>Buat tugas</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => {
              const waiting = t.submitted - t.graded
              return (
                <li key={t.id}>
                  <Link to={`/guru/kelas/${course.id}/tugas/${t.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-medium text-slate-900">{t.title}</p>
                      <DueLabel dueAt={t.due_at} />
                      {t.status === 'published' && (
                        <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                          <span>{t.submitted}/{t.student_count} terkumpul</span>
                          {t.late > 0 && <span className="text-red-600">{t.late} terlambat</span>}
                          <span>{t.graded} dinilai</span>
                          {t.grades_published > 0 && <span>{t.grades_published} nilai terbit</span>}
                        </p>
                      )}
                    </div>
                    {waiting > 0 && <Badge tone="orange">{waiting} perlu dinilai</Badge>}
                    <PublishBadge status={t.status} />
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <NewTaskModal open={open} taId={course.id} onClose={() => setOpen(false)} onCreated={refetch} />
    </div>
  )
}
