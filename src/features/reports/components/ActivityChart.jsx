import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, ErrorState, Skeleton, Tabs } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { fetchActivity, rkeys } from '../api'

/** Grafik aktivitas harian guru & siswa (sekolah / kelas / ruang kelas). */
export function ActivityChart({ classId = null, taId = null, title = 'Aktivitas pembelajaran', description }) {
  const [days, setDays] = useState('30')
  const q = useQuery({ queryKey: rkeys.activity({ days, classId, taId }), queryFn: () => fetchActivity({ days: Number(days), classId, taId }) })
  const data = (q.data ?? []).map((d) => ({
    hari: formatDate(d.day, 'd MMM'),
    'Aktivitas siswa': d.student_events,
    'Aktivitas guru': d.teacher_events,
    'Siswa aktif': d.active_students,
  }))
  const totalStudents = (q.data ?? []).reduce((n, d) => n + d.student_events, 0)
  const totalTeachers = (q.data ?? []).reduce((n, d) => n + d.teacher_events, 0)

  return (
    <Card>
      <CardHeader
        icon={Activity}
        title={title}
        description={description ?? (q.data ? `${totalStudents} aktivitas siswa · ${totalTeachers} aktivitas guru` : undefined)}
        action={<Tabs value={days} onChange={setDays} tabs={[{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }]} />}
      />
      <div className="h-72 p-4">
        {q.isLoading ? (
          <Skeleton className="h-full rounded-lg" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient>
                <linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="hari" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" minTickGap={20} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Aktivitas siswa" stroke="#2563eb" fill="url(#gs)" strokeWidth={2} />
              <Area type="monotone" dataKey="Aktivitas guru" stroke="#f97316" fill="url(#gt)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
        Aktivitas siswa: membuka/menyelesaikan materi, mengumpulkan tugas, mengerjakan kuis, menulis di forum. Aktivitas guru: menerbitkan materi/tugas/kuis, menilai, pengumuman, forum.
      </p>
    </Card>
  )
}
