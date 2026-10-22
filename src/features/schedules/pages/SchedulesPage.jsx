import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, GraduationCap, School } from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, FilterSelect, PageHeader, Skeleton, Tabs } from '@/components/ui'
import { fetchSchedules, keys } from '@/features/master/api'
import { useActiveSemester, useClasses, useTeacherOptions } from '@/features/master/hooks'
import { ClassScheduleEditor } from '../components/ClassScheduleEditor'
import { WeekSchedule } from '../components/WeekSchedule'

function TeacherView({ semesterId }) {
  const teachers = useTeacherOptions()
  const [teacherId, setTeacherId] = useState('')
  const tid = teacherId || teachers.data?.[0]?.id
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: keys.teacherSchedule(tid, semesterId),
    queryFn: () => fetchSchedules({ semesterId, teacherId: tid }),
    enabled: Boolean(tid),
  })
  const minutes = (data ?? []).reduce((n, s) => {
    const [h1, m1] = s.start_time.split(':').map(Number)
    const [h2, m2] = s.end_time.split(':').map(Number)
    return n + (h2 * 60 + m2 - (h1 * 60 + m1))
  }, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilterSelect value={tid ?? ''} onChange={setTeacherId} label="Guru" className="sm:w-72">
          {(teachers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </FilterSelect>
        {data && <p className="text-sm text-slate-500">{data.length} sesi · {Math.round(minutes / 60 * 10) / 10} jam per minggu</p>}
      </div>
      {!tid ? (
        <Card><EmptyState icon={GraduationCap} title="Belum ada data guru" /></Card>
      ) : isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <WeekSchedule items={data} subtitle={(s) => s.class_name} />
      )}
    </div>
  )
}

export default function SchedulesPage() {
  const active = useActiveSemester()
  const classes = useClasses(active.yearId, active.semesterId)
  const [view, setView] = useState('class')
  const [classId, setClassId] = useState('')
  const cid = classId || classes.data?.[0]?.id

  if (!active.semesterId) {
    return (
      <Card>
        <EmptyState icon={CalendarClock} title="Belum ada semester aktif" description="Jadwal disusun untuk semester aktif." action={<Link to="/admin/tahun-pelajaran"><Button>Ke Tahun Pelajaran</Button></Link>} />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Jadwal Pelajaran" description={`Semester aktif: ${active.label}. Jadwal yang bentrok (kelas atau guru) otomatis ditolak.`} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'class', label: 'Per kelas', icon: School },
            { value: 'teacher', label: 'Per guru', icon: GraduationCap },
          ]}
        />
        {view === 'class' && (
          <FilterSelect value={cid ?? ''} onChange={setClassId} label="Kelas" className="sm:w-44">
            {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
        )}
      </div>
      {view === 'teacher' ? (
        <TeacherView semesterId={active.semesterId} />
      ) : classes.isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !cid ? (
        <Card><EmptyState icon={School} title="Belum ada kelas" action={<Link to="/admin/kelas"><Button>Ke Kelas</Button></Link>} /></Card>
      ) : (
        <ClassScheduleEditor classId={cid} semesterId={active.semesterId} />
      )}
    </div>
  )
}
