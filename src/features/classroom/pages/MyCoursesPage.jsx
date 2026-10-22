import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Sparkles } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { ckeys, fetchMyCourses } from '../api'
import { ProgressRing } from '../components/status'

/** Daftar mata pelajaran siswa beserta progress belajarnya. */
export default function MyCoursesPage() {
  const { profile } = useAuth()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ckeys.myCourses, queryFn: fetchMyCourses })

  return (
    <div className="space-y-6">
      <PageHeader title="Mata Pelajaran" description={profile.student_class ? `Kelas ${profile.student_class.name}` : 'Kamu belum ditempatkan di kelas.'} />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : data.length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="Belum ada mata pelajaran" description="Mata pelajaran akan muncul setelah sekolah menetapkan guru untuk kelasmu." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => {
            const pct = c.lesson_count ? (c.completed_count / c.lesson_count) * 100 : 0
            return (
              <Link key={c.teaching_assignment_id} to={`/siswa/mapel/${c.teaching_assignment_id}`} className="group block">
                <Card className="h-full p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: c.subject_color }}>
                      {c.subject_code.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-slate-900">{c.subject_name}</p>
                      <p className="truncate text-xs text-slate-500">{c.teacher_name}</p>
                    </div>
                    <ProgressRing value={pct} size={52} stroke={5} color={c.subject_color} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{c.completed_count}/{c.lesson_count} pertemuan selesai</span>
                    {c.last_viewed_at && <span>dibuka {formatRelative(c.last_viewed_at)}</span>}
                  </div>
                  {c.latest_lesson_title && (
                    <p className="mt-2 flex items-center gap-1.5 truncate rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-500" /> Terbaru: {c.latest_lesson_title}
                    </p>
                  )}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
