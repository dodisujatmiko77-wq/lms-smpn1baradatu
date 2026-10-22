import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, BookOpenCheck, CheckCircle2, ClipboardList, Library, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows, StatCard } from '@/components/ui'
import { ckeys, fetchMyCourses } from '@/features/classroom/api'
import { ProgressBar } from '@/features/classroom/components/status'
import { useActiveSemester } from '@/features/master/hooks'
import { TodaySchedule } from '@/features/schedules/components/TodaySchedule'
import { fetchMyTasks, tkeys } from '@/features/tasks/api'
import { TaskCard } from '@/features/tasks/components/TaskCard'
import { studentTaskStatus } from '@/features/tasks/status'
import { fetchMyQuizzes, qkeys } from '@/features/quizzes/api'
import { QuizCard } from '@/features/quizzes/components/QuizCard'
import { studentQuizStatus } from '@/features/quizzes/status'
import { formatRelative } from '@/lib/utils'
import { AnnouncementsWidget } from '@/features/announcements/components/AnnouncementsWidget'
import { BadgesCard } from '@/features/achievements/components/BadgesCard'
import { WelcomeBanner } from '../components/WelcomeBanner'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const active = useActiveSemester()
  const courses = useQuery({ queryKey: ckeys.myCourses, queryFn: fetchMyCourses })
  const tasks = useQuery({ queryKey: tkeys.mine, queryFn: fetchMyTasks })
  const quizzes = useQuery({ queryKey: qkeys.mine, queryFn: fetchMyQuizzes })
  const activeQuizzes = (quizzes.data ?? []).filter((q) => ['in_progress', 'open', 'upcoming'].includes(studentQuizStatus(q)))
  const upcoming = (tasks.data ?? [])
    .filter((t) => ['todo', 'draft', 'missing'].includes(studentTaskStatus(t)))
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
  const cls = profile.student_class
  const list = courses.data ?? []
  const totalLessons = list.reduce((n, c) => n + c.lesson_count, 0)
  const totalDone = list.reduce((n, c) => n + c.completed_count, 0)
  const pct = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0
  const latest = [...list].filter((c) => c.latest_published_at).sort((a, b) => b.latest_published_at.localeCompare(a.latest_published_at)).slice(0, 4)

  return (
    <div className="space-y-6">
      <WelcomeBanner
        subtitle={cls ? `Kelas ${cls.name} · ${active.label}. Semangat belajar hari ini!` : 'Kamu belum ditempatkan di kelas. Hubungi wali kelas atau operator sekolah.'}
      />

      {activeQuizzes.length > 0 && (
        <Card>
          <CardHeader icon={BookOpenCheck} title="Kuis & ujian aktif" action={<Link to="/siswa/kuis" className="text-sm font-medium text-primary-600 hover:text-primary-700">Semua</Link>} />
          <div className="grid gap-2 p-3 lg:grid-cols-2">{activeQuizzes.slice(0, 4).map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Progress belajar" value={`${pct}%`} icon={TrendingUp} tone="blue" loading={courses.isLoading} hint="Dari seluruh pertemuan yang terbit" />
        <StatCard label="Pertemuan selesai" value={totalDone} icon={CheckCircle2} tone="green" loading={courses.isLoading} hint={`dari ${totalLessons} pertemuan`} />
        <StatCard label="Tugas belum selesai" value={upcoming.length} icon={ClipboardList} tone="orange" loading={tasks.isLoading} hint={upcoming[0] ? `Terdekat: ${upcoming[0].title}` : 'Tidak ada tugas tertunda'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaySchedule linkTo="/siswa/jadwal" />
        </div>
        <Card>
          <CardHeader icon={ClipboardList} title="Tugas mendatang" action={<Link to="/siswa/tugas" className="text-sm font-medium text-primary-600 hover:text-primary-700">Semua</Link>} />
          {tasks.isLoading ? (
            <SkeletonRows rows={3} />
          ) : upcoming.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tidak ada tugas tertunda" description="Kerja bagus! Tugas baru akan muncul di sini." />
          ) : (
            <div className="space-y-2 p-3">{upcoming.slice(0, 3).map((t) => <TaskCard key={t.id} task={t} />)}</div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={Library}
          title="Progress per mata pelajaran"
          action={<Link to="/siswa/mapel" className="text-sm font-medium text-primary-600 hover:text-primary-700">Semua</Link>}
        />
        {courses.isLoading ? (
          <SkeletonRows rows={3} />
        ) : courses.isError ? (
          <ErrorState error={courses.error} onRetry={courses.refetch} />
        ) : list.length === 0 ? (
          <EmptyState icon={Library} title="Belum ada mata pelajaran" description="Mata pelajaran muncul setelah sekolah menetapkan guru untuk kelasmu." />
        ) : (
          <ul className="grid gap-x-6 gap-y-1 p-3 sm:grid-cols-2">
            {list.map((c) => (
              <li key={c.teaching_assignment_id}>
                <Link to={`/siswa/mapel/${c.teaching_assignment_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: c.subject_color }}>
                    {c.subject_code.slice(0, 3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.subject_name}</p>
                      <span className="shrink-0 text-xs text-slate-500">{c.completed_count}/{c.lesson_count}</span>
                    </div>
                    <ProgressBar value={c.lesson_count ? (c.completed_count / c.lesson_count) * 100 : 0} className="mt-1.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Sparkles} title="Materi terbaru" />
          {courses.isLoading ? (
            <SkeletonRows rows={3} />
          ) : latest.length === 0 ? (
            <EmptyState icon={BookOpen} title="Belum ada materi" description="Materi dari gurumu akan muncul di sini." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {latest.map((c) => (
                <li key={c.teaching_assignment_id}>
                  <Link to={`/siswa/mapel/${c.teaching_assignment_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.subject_color }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.latest_lesson_title}</p>
                      <p className="truncate text-xs text-slate-500">{c.subject_name} · {formatRelative(c.latest_published_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <AnnouncementsWidget linkTo="/siswa/pengumuman" />
      </div>

      <BadgesCard />
    </div>
  )
}
