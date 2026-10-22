import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { useActiveSemester } from '@/features/master/hooks'
import { unwrap } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { WeekSchedule } from '../components/WeekSchedule'

export const fetchMySchedule = async () => unwrap(await supabase.rpc('get_my_schedule'))

/** Jadwal guru (yang ia ajar) atau siswa (kelasnya) pada semester aktif. */
export default function MySchedulePage() {
  const { profile } = useAuth()
  const active = useActiveSemester()
  const isTeacher = Boolean(profile.teacher_id)
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['my-schedule'], queryFn: fetchMySchedule })

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTeacher ? 'Jadwal Mengajar' : 'Jadwal Pelajaran'}
        description={
          active.label
            ? `${active.label}${profile.student_class ? ` · Kelas ${profile.student_class.name}` : ''}`
            : 'Semester aktif belum diatur oleh sekolah.'
        }
      />
      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Jadwal belum tersedia"
            description={isTeacher ? 'Jadwal mengajar akan tampil setelah administrator menyusun jadwal kelas Anda.' : 'Jadwal kelasmu akan tampil setelah disusun oleh sekolah.'}
          />
        </Card>
      ) : (
        <WeekSchedule items={data} subtitle={(s) => (isTeacher ? `Kelas ${s.class_name}` : s.teacher_name)} />
      )}
    </div>
  )
}
