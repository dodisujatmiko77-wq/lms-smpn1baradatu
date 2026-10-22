import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarClock, School, Users } from 'lucide-react'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { useActiveSemester } from '@/features/master/hooks'
import { fetchMyTeaching } from '../api'

/** Daftar ruang kelas digital milik guru (semester aktif). */
export default function MyClassesPage() {
  const active = useActiveSemester()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['my-teaching'], queryFn: fetchMyTeaching })

  return (
    <div className="space-y-6">
      <PageHeader title="Kelas Saya" description={active.label ? `Ruang kelas digital semester ${active.label}.` : 'Semester aktif belum diatur.'} />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : data.length === 0 ? (
        <Card><EmptyState icon={School} title="Belum ada kelas" description="Ruang kelas muncul setelah administrator menetapkan penugasan mengajar Anda." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Link key={c.teaching_assignment_id} to={`/guru/kelas/${c.teaching_assignment_id}`} className="group block">
              <Card className="h-full overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                <div className="relative h-24 p-4 text-white" style={{ background: `linear-gradient(135deg, ${c.subject_color}, ${c.subject_color}b3)` }}>
                  <BookOpen className="absolute -bottom-3 right-3 h-20 w-20 text-white/15" />
                  <p className="text-xs font-medium text-white/80">{c.subject_code}</p>
                  <p className="font-display text-lg font-semibold leading-tight">{c.subject_name}</p>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="font-display text-2xl font-semibold text-slate-900">{c.class_name}</p>
                  <div className="space-y-1 text-right text-xs text-slate-500">
                    <p className="flex items-center justify-end gap-1"><Users className="h-3.5 w-3.5" /> {c.student_count} siswa</p>
                    <p className="flex items-center justify-end gap-1"><CalendarClock className="h-3.5 w-3.5" /> {c.schedule_count} sesi/minggu</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
