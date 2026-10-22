import { ShieldCheck } from 'lucide-react'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui'
import { AssignmentMonitor } from '../components/AssignmentMonitor'
import { useReportClasses } from '../hooks'

/** Monitoring tugas lintas mapel untuk kelas binaan. */
export default function GuardianAssignmentsPage() {
  const { classes, current, setPicked, isLoading } = useReportClasses({ guardianOnly: true })
  if (isLoading) return <Skeleton className="h-80 rounded-xl" />
  if (!current) return <Card><EmptyState icon={ShieldCheck} title="Anda bukan wali kelas pada semester ini" /></Card>
  return (
    <div className="space-y-6">
      <PageHeader title={`Monitoring Tugas — Kelas ${current.name}`} description="Semua tugas dari seluruh mata pelajaran di kelas binaan. Klik tugas untuk melihat siswa yang belum mengumpulkan." />
      <AssignmentMonitor key={current.id} classId={current.id} classes={classes.length > 1 ? classes : null} onClassChange={setPicked} title={`Monitoring tugas kelas ${current.name}`} />
    </div>
  )
}
