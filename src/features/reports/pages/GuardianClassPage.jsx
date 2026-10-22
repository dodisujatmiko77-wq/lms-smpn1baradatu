import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BookOpenCheck, ClipboardList, ShieldCheck, Star, Users } from 'lucide-react'
import { Card, EmptyState, PageHeader, Skeleton, StatCard } from '@/components/ui'
import { fetchClassSummary, fetchFollowups, pivotClassSummary, rkeys } from '../api'
import { ActivityChart } from '../components/ActivityChart'
import { ClassPicker } from '../components/ClassPicker'
import { ClassReport } from '../components/ClassReport'
import { fmt } from '../components/ScoreCell'
import { useReportClasses } from '../hooks'

function Stats({ classId }) {
  const summary = useQuery({ queryKey: rkeys.classSummary(classId), queryFn: () => fetchClassSummary(classId) })
  const follow = useQuery({ queryKey: rkeys.followups(classId), queryFn: () => fetchFollowups(classId) })
  const p = pivotClassSummary(summary.data ?? [])
  const avgs = p.students.map((s) => s.avg).filter((v) => v != null)
  const progs = p.students.map((s) => s.progress).filter((v) => v != null)
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const flagged = (follow.data ?? []).filter((f) => f.severity >= 2).length
  const missing = p.students.reduce((n, s) => n + s.missing, 0)
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Siswa" value={p.students.length} icon={Users} tone="blue" loading={summary.isLoading} hint={`${p.subjects.length} mata pelajaran`} />
      <StatCard label="Rata-rata nilai kelas" value={fmt(mean(avgs))} icon={Star} tone="violet" loading={summary.isLoading} hint={`KKM ${p.kkm}`} />
      <StatCard label="Penyelesaian materi" value={progs.length ? `${fmt(mean(progs), 0)}%` : '–'} icon={BookOpenCheck} tone="green" loading={summary.isLoading} hint={`${missing} tugas terlewat di kelas`} />
      <Link to="/guru/wali-kelas/tindak-lanjut" className="block">
        <StatCard label="Perlu tindak lanjut" value={flagged} icon={AlertTriangle} tone="orange" loading={follow.isLoading} hint="Lihat daftar & alasannya →" />
      </Link>
    </div>
  )
}

/** Dashboard kelas binaan (wali kelas). */
export default function GuardianClassPage() {
  const { classes, current, setPicked, isLoading } = useReportClasses({ guardianOnly: true })
  if (isLoading) return <Skeleton className="h-80 rounded-xl" />
  if (!current) return <Card><EmptyState icon={ShieldCheck} title="Anda bukan wali kelas pada semester ini" description="Menu ini aktif bila administrator menetapkan Anda sebagai wali kelas." /></Card>

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Kelas Binaan ${current.name}`}
        description="Pantau nilai, penyelesaian materi, dan keaktifan siswa di semua mata pelajaran."
        actions={
          <>
            <Link to="/guru/wali-kelas/tugas" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><ClipboardList className="h-4 w-4" /> Monitoring tugas</Link>
          </>
        }
      >
        <div className="mt-3"><ClassPicker classes={classes} current={current} onChange={setPicked} /></div>
      </PageHeader>
      <Stats key={`s-${current.id}`} classId={current.id} />
      <ClassReport key={current.id} classId={current.id} className={current.name} />
      <ActivityChart key={`a-${current.id}`} classId={current.id} title={`Keaktifan kelas ${current.name}`} />
    </div>
  )
}
