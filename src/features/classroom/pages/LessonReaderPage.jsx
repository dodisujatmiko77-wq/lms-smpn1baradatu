import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { ckeys, fetchLesson, fetchMyProgress, markProgress } from '../api'
import { MaterialList } from '../components/materials'
import { RichContent } from '../components/RichContent'
import { StudentStatusBadge } from '../components/status'
import { lessonStudentStatus, useCourse } from '../hooks'

/** Halaman baca materi untuk siswa (nyaman di HP, tanpa harus mengunduh berkas). */
export default function LessonReaderPage() {
  const { taId, lessonId } = useParams()
  const qc = useQueryClient()
  const { course, lessons } = useCourse(taId)
  const lesson = useQuery({ queryKey: ckeys.lesson(lessonId), queryFn: () => fetchLesson(lessonId) })
  const progress = useQuery({ queryKey: ckeys.myProgress(taId), queryFn: () => fetchMyProgress(taId) })
  const opened = useRef(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ckeys.myProgress(taId) })
    qc.invalidateQueries({ queryKey: ckeys.myCourses })
  }

  // Catat "sedang dipelajari" sekali setiap kali pertemuan dibuka.
  useEffect(() => {
    if (!lesson.data || opened.current === lessonId) return
    opened.current = lessonId
    markProgress(lessonId, 'open').then(refresh, () => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.data, lessonId])

  const mark = useMutation({
    mutationFn: (action) => markProgress(lessonId, action),
    onSuccess: (_, action) => {
      refresh()
      if (action === 'complete') toast.success('Hebat! Pertemuan ditandai selesai. 🎉')
    },
    onError: (e) => toast.error(toMessage(e)),
  })

  if (lesson.isLoading || course.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (lesson.isError) return <Card><EmptyState icon={Target} title="Pertemuan tidak tersedia" description="Pertemuan ini belum dipublikasikan atau tidak ditujukan untuk kelasmu." action={<Link to={`/siswa/mapel/${taId}`}><Button variant="outline">Kembali</Button></Link>} /></Card>
  if (course.isError) return <Card><ErrorState error={course.error} onRetry={course.refetch} /></Card>

  const l = lesson.data
  const list = lessons.data ?? []
  const idx = list.findIndex((x) => x.id === lessonId)
  const prev = idx > 0 ? list[idx - 1] : null
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null
  const status = lessonStudentStatus(progress.data?.get(lessonId))
  const completed = status === 'completed'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to={`/siswa/mapel/${taId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {course.data?.subject_name}
      </Link>

      <article className="space-y-6">
        <header className="space-y-3">
          <p className="subject-color text-sm font-medium" style={{ '--subject-color': course.data?.subject_color }}>
            Pertemuan {l.meeting_number ?? ''} · {course.data?.subject_name}
          </p>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{l.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <StudentStatusBadge status={status} />
            {l.published_at && <span>Terbit {formatDate(l.published_at, 'd MMMM yyyy')}</span>}
          </div>
          {l.summary && (
            <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50/70 p-4 text-sm text-primary-900">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              <p>{l.summary}</p>
            </div>
          )}
        </header>

        <RichContent html={l.content_html} />

        {(l.lesson_materials ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Materi & sumber belajar</h2>
            <MaterialList materials={l.lesson_materials} />
          </section>
        )}
      </article>

      <Card className={completed ? 'border-success-100 bg-success-50/60' : ''}>
        <div className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left">
          <CheckCircle2 className={completed ? 'h-10 w-10 text-success-600' : 'h-10 w-10 text-slate-300'} />
          <div className="flex-1">
            <p className="font-semibold text-slate-900">{completed ? 'Kamu sudah menyelesaikan pertemuan ini' : 'Sudah selesai mempelajari materi ini?'}</p>
            <p className="text-sm text-slate-500">{completed ? 'Lanjutkan ke pertemuan berikutnya.' : 'Tandai selesai agar progress belajarmu tercatat.'}</p>
          </div>
          {completed ? (
            <Button variant="ghost" icon={RotateCcw} loading={mark.isPending} onClick={() => mark.mutate('undo')}>Batal tandai</Button>
          ) : (
            <Button variant="success" size="lg" icon={CheckCircle2} loading={mark.isPending} onClick={() => mark.mutate('complete')}>Tandai Selesai</Button>
          )}
        </div>
      </Card>

      <nav className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link to={`/siswa/mapel/${taId}/pertemuan/${prev.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0"><span className="block text-xs text-slate-500">Sebelumnya</span><span className="block truncate font-medium">{prev.title}</span></span>
          </Link>
        ) : <span />}
        {next && (
          <Link to={`/siswa/mapel/${taId}/pertemuan/${next.id}`} className="flex items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3 text-right text-sm hover:bg-slate-50">
            <span className="min-w-0"><span className="block text-xs text-slate-500">Berikutnya</span><span className="block truncate font-medium">{next.title}</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        )}
      </nav>
    </div>
  )
}
