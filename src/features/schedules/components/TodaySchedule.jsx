import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Coffee } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { hhmm, todayDow } from '@/lib/academic'
import { cn } from '@/lib/utils'
import { fetchMySchedule } from '../pages/MySchedulePage'

/** Kartu "Jadwal hari ini" untuk dashboard guru/siswa (data dari get_my_schedule). */
export function TodaySchedule({ isTeacher, linkTo }) {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['my-schedule'], queryFn: fetchMySchedule })
  const dow = todayDow()
  const today = (data ?? []).filter((s) => s.day_of_week === dow)
  const nowStr = new Date().toTimeString().slice(0, 5)

  return (
    <Card>
      <CardHeader
        icon={CalendarClock}
        title="Jadwal hari ini"
        description={today.length ? `${today.length} sesi` : undefined}
        action={<Link to={linkTo} className="text-sm font-medium text-primary-600 hover:text-primary-700">Seminggu</Link>}
      />
      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={CalendarClock} title="Jadwal belum tersedia" description="Jadwal akan tampil setelah disusun oleh sekolah." />
      ) : !dow || today.length === 0 ? (
        <EmptyState icon={Coffee} tone="accent" title="Tidak ada jadwal hari ini" description="Selamat beristirahat!" />
      ) : (
        <ol className="relative space-y-1 p-3">
          {today.map((s) => {
            const now = hhmm(s.start_time) <= nowStr && nowStr < hhmm(s.end_time)
            const done = nowStr >= hhmm(s.end_time)
            return (
              <li key={s.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5', now && 'bg-primary-50 ring-1 ring-primary-200', done && 'opacity-55')}>
                <div className="w-14 shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{hhmm(s.start_time)}</p>
                  <p className="text-[11px] text-slate-500">{hhmm(s.end_time)}</p>
                </div>
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.subject_color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.subject_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {isTeacher ? `Kelas ${s.class_name}` : s.teacher_name}
                    {s.room ? ` · ${s.room}` : ''}
                  </p>
                </div>
                {now && <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-medium text-white">Berlangsung</span>}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
