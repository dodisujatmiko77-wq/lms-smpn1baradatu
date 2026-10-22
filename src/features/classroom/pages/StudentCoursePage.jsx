import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, BookOpenCheck, ChevronRight, ClipboardList, MessagesSquare, Paperclip } from 'lucide-react'
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui'
import { fetchMyTasks, tkeys } from '@/features/tasks/api'
import { TaskCard } from '@/features/tasks/components/TaskCard'
import { fetchMyQuizzes, qkeys } from '@/features/quizzes/api'
import { QuizCard } from '@/features/quizzes/components/QuizCard'
import { CourseForumTab } from '@/features/forum/components/CourseForumTab'
import { AnnouncementsWidget } from '@/features/announcements/components/AnnouncementsWidget'
import { cn } from '@/lib/utils'
import { ckeys, fetchMyProgress } from '../api'
import { CourseHeader } from '../components/CourseHeader'
import { ProgressBar, StudentStatusBadge, StudentStatusIcon } from '../components/status'
import { groupLessons, lessonStudentStatus, useCourse } from '../hooks'

/** Ruang kelas digital — sisi siswa: daftar pertemuan per bab dengan status belajar. */
export default function StudentCoursePage() {
  const { taId } = useParams()
  const { course, sections, lessons } = useCourse(taId)
  const progress = useQuery({ queryKey: ckeys.myProgress(taId), queryFn: () => fetchMyProgress(taId) })
  const tasks = useQuery({ queryKey: tkeys.mine, queryFn: fetchMyTasks })
  const quizzes = useQuery({ queryKey: qkeys.mine, queryFn: fetchMyQuizzes })
  const [params, setParams] = useSearchParams()
  const tab = ['tugas', 'kuis', 'diskusi'].includes(params.get('tab')) ? params.get('tab') : 'materi'
  const setTab = (v) => setParams(v === 'materi' ? {} : { tab: v }, { replace: true })

  if (course.isLoading) return <Skeleton className="h-56 rounded-2xl" />
  if (course.isError) return <Card><ErrorState error={course.error} onRetry={course.refetch} /></Card>
  if (!course.data) return <Card><EmptyState icon={BookOpen} title="Mata pelajaran tidak ditemukan" /></Card>

  const list = lessons.data ?? []
  const prog = progress.data ?? new Map()
  const done = list.filter((l) => prog.get(l.id)?.status === 'completed').length
  const pct = list.length ? (done / list.length) * 100 : 0
  const courseTasks = (tasks.data ?? []).filter((t) => t.teaching_assignment_id === taId)
  const courseQuizzes = (quizzes.data ?? []).filter((q) => q.teaching_assignment_id === taId)
  const next = list.find((l) => prog.get(l.id)?.status !== 'completed')

  return (
    <div className="space-y-6">
      <CourseHeader course={course.data} backTo="/siswa/mapel" backLabel="Mata Pelajaran">
        <div className="w-full rounded-xl bg-white/15 p-4 backdrop-blur lg:w-72">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress belajarku</span>
            <span className="font-semibold">{Math.round(pct)}%</span>
          </div>
          <ProgressBar value={pct} tone="white" className="mt-2 bg-white/25" />
          <p className="mt-2 text-xs text-white/80">{done} dari {list.length} pertemuan selesai</p>
        </div>
      </CourseHeader>

      <AnnouncementsWidget taId={taId} limit={2} hideWhenEmpty title="Pengumuman kelas" />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'materi', label: 'Materi', icon: BookOpen, count: list.length },
          { value: 'tugas', label: 'Tugas', icon: ClipboardList, count: courseTasks.length },
          { value: 'kuis', label: 'Kuis', icon: BookOpenCheck, count: courseQuizzes.length },
          { value: 'diskusi', label: 'Diskusi', icon: MessagesSquare },
        ]}
      />

      {tab === 'diskusi' ? (
        <CourseForumTab taId={taId} />
      ) : tab === 'tugas' ? (
        courseTasks.length === 0 ? (
          <Card><EmptyState icon={ClipboardList} title="Belum ada tugas" description="Tugas dari guru mapel ini akan muncul di sini." /></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {courseTasks.map((t) => <TaskCard key={t.id} task={t} showSubject={false} />)}
          </div>
        )
      ) : tab === 'kuis' ? (
        quizzes.isError ? (
          <Card><ErrorState error={quizzes.error} onRetry={quizzes.refetch} /></Card>
        ) : courseQuizzes.length === 0 ? (
          <Card><EmptyState icon={BookOpenCheck} title="Belum ada kuis" description="Kuis dan ujian dari guru mapel ini akan muncul di sini." /></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {courseQuizzes.map((q) => <QuizCard key={q.id} quiz={q} showSubject={false} />)}
          </div>
        )
      ) : (
      <>
      {next && (
        <Link to={`/siswa/mapel/${taId}/pertemuan/${next.id}`} className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm transition hover:bg-primary-100">
          <StudentStatusIcon status={lessonStudentStatus(prog.get(next.id))} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-primary-700">{prog.get(next.id) ? 'Lanjutkan belajar' : 'Mulai belajar'}</span>
            <span className="block truncate font-semibold text-slate-900">Pertemuan {next.meeting_number ?? ''}: {next.title}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-primary-400" />
        </Link>
      )}

      {lessons.isLoading || sections.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : list.length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="Belum ada materi" description="Gurumu belum mempublikasikan pertemuan. Cek lagi nanti, ya!" /></Card>
      ) : (
        groupLessons(sections.data, list).filter((g) => g.lessons.length).map(({ section, lessons: items }) => (
          <section key={section?.id ?? 'loose'} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{section?.title ?? 'Pertemuan lainnya'}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((l) => {
                const status = lessonStudentStatus(prog.get(l.id))
                return (
                  <Link
                    key={l.id}
                    to={`/siswa/mapel/${taId}/pertemuan/${l.id}`}
                    className={cn(
                      'group flex items-center gap-4 rounded-xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover',
                      status === 'completed' ? 'border-success-100' : status === 'in_progress' ? 'border-primary-200' : 'border-slate-200/70',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-12 w-12 shrink-0 place-items-center rounded-xl text-base font-bold',
                        status === 'completed' ? 'bg-success-50 text-success-700' : status === 'in_progress' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {l.meeting_number ?? '•'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-slate-900">{l.title}</p>
                      {l.summary && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{l.summary}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StudentStatusBadge status={status} />
                        {l.material_count > 0 && <span className="flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" /> {l.material_count}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5" />
                  </Link>
                )
              })}
            </div>
          </section>
        ))
      )}
      </>
      )}
    </div>
  )
}
