import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { Card, EmptyState, ErrorState, FilterSelect, PageHeader, Skeleton } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { ActivityChart } from '../components/ActivityChart'
import { TaGradesReport } from '../components/TaGradesReport'

/** Laporan Pembelajaran guru: rekap nilai & aktivitas per kelas-mapel. */
export default function TeacherReportsPage() {
  const [params, setParams] = useSearchParams()
  const q = useQuery({ queryKey: ['my-teaching'], queryFn: async () => unwrap(await supabase.rpc('get_my_teaching')) })
  const rows = q.data ?? []
  const current = rows.find((r) => r.teaching_assignment_id === params.get('ta')) ?? rows[0]

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Pembelajaran" description="Rekap nilai tugas & kuis serta keaktifan siswa di kelas yang Anda ajar. Dapat diunduh ke Excel atau PDF." />
      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
      ) : !current ? (
        <Card><EmptyState icon={BarChart3} title="Belum ada kelas yang diajar" description="Laporan tersedia setelah administrator menetapkan penugasan mengajar Anda." /></Card>
      ) : (
        <>
          <div className="sm:w-80">
            <FilterSelect value={current.teaching_assignment_id} onChange={(v) => setParams({ ta: v }, { replace: true })} label="Kelas-mapel">
              {rows.map((r) => <option key={r.teaching_assignment_id} value={r.teaching_assignment_id}>{r.class_name} · {r.subject_name}</option>)}
            </FilterSelect>
          </div>
          <TaGradesReport key={current.teaching_assignment_id} taId={current.teaching_assignment_id} label={`${current.subject_name} kelas ${current.class_name}`} />
          <ActivityChart key={`a-${current.teaching_assignment_id}`} taId={current.teaching_assignment_id} title={`Keaktifan kelas ${current.class_name}`} />
        </>
      )}
    </div>
  )
}
