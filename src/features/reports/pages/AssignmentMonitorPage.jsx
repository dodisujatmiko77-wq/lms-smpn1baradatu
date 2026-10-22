import { useState } from 'react'
import { PageHeader, Skeleton } from '@/components/ui'
import { AssignmentMonitor } from '../components/AssignmentMonitor'
import { useReportClasses } from '../hooks'

/** Monitoring tugas & pengumpulan seluruh sekolah (admin). */
export default function AssignmentMonitorPage() {
  const { classes, isLoading } = useReportClasses()
  const [classId, setClassId] = useState(null)
  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring Tugas & Pengumpulan" description="Persentase pengumpulan, keterlambatan, dan siswa yang belum mengumpulkan untuk setiap tugas di semester aktif." />
      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : <AssignmentMonitor classId={classId} classes={classes} onClassChange={setClassId} title="Monitoring tugas sekolah" />}
    </div>
  )
}
