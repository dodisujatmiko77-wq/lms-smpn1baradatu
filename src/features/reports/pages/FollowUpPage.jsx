import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Avatar, Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonRows } from '@/components/ui'
import { cn } from '@/lib/utils'
import { fetchFollowups, rkeys } from '../api'
import { ClassPicker } from '../components/ClassPicker'
import { ExportButtons } from '../components/ExportButtons'
import { ScoreCell, fmt } from '../components/ScoreCell'
import { useReportClasses } from '../hooks'

const level = (s) => (s >= 4 ? { label: 'Prioritas', tone: 'red' } : s >= 2 ? { label: 'Perlu perhatian', tone: 'orange' } : s >= 1 ? { label: 'Pantau', tone: 'blue' } : { label: 'Baik', tone: 'green' })

function List({ cls }) {
  const { kkm = 75 } = useSchoolSettings()
  const q = useQuery({ queryKey: rkeys.followups(cls.id), queryFn: () => fetchFollowups(cls.id) })
  if (q.isLoading) return <Card><SkeletonRows rows={6} /></Card>
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
  const rows = q.data ?? []
  const flagged = rows.filter((r) => r.severity > 0)
  const ok = rows.filter((r) => r.severity === 0)
  const build = () => ({
    fileName: `Tindak lanjut kelas ${cls.name}`,
    title: `Siswa Perlu Tindak Lanjut — Kelas ${cls.name}`,
    subtitle: 'Diurutkan dari prioritas tertinggi.',
    columns: [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Nama', key: 'full_name', width: 26 },
      { header: 'NISN', key: 'nisn', width: 13 },
      { header: 'Tingkat', key: 'level', width: 14 },
      { header: 'Rata-rata', key: 'avg', width: 9 },
      { header: 'Tugas terlewat', key: 'missing_tasks', width: 9 },
      { header: 'Kuis terlewat', key: 'missed_quizzes', width: 9 },
      { header: 'Materi %', key: 'progress', width: 9 },
      { header: 'Alasan', key: 'why', width: 60 },
    ],
    rows: rows.map((r, i) => ({ ...r, no: i + 1, level: level(r.severity).label, avg: r.overall_avg == null ? null : Number(r.overall_avg), progress: r.progress_pct == null ? null : Number(r.progress_pct), why: r.reasons.join('; ') || '-' })),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{flagged.length}</span> dari {rows.length} siswa perlu perhatian</p>
        <ExportButtons build={build} disabled={!rows.length} />
      </div>
      {flagged.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title="Tidak ada siswa yang perlu tindak lanjut" description="Semua siswa aktif, mengumpulkan tugas, dan nilainya di atas KKM." /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {flagged.map((r) => {
              const lv = level(r.severity)
              return (
                <li key={r.student_id}>
                  <Link to={`/laporan/siswa/${r.student_id}`} className="flex items-start gap-3 px-5 py-4 transition hover:bg-slate-50">
                    <Avatar name={r.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{r.full_name}</p>
                        <Badge tone={lv.tone}>{lv.label}</Badge>
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {r.reasons.map((x) => (
                          <li key={x} className="flex items-start gap-1.5 text-sm text-slate-600"><AlertTriangle className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', lv.tone === 'red' ? 'text-red-500' : 'text-accent-500')} /> {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
                      <p>Rata-rata <ScoreCell value={r.overall_avg} kkm={kkm} /></p>
                      <p>Materi {r.progress_pct == null ? '–' : `${fmt(r.progress_pct, 0)}%`}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      {ok.length > 0 && <p className="px-1 text-xs text-slate-500">{ok.length} siswa lainnya dalam kondisi baik.</p>}
    </div>
  )
}

/** Siswa Perlu Tindak Lanjut (wali kelas). */
export default function FollowUpPage() {
  const { classes, current, setPicked, isLoading } = useReportClasses({ guardianOnly: true })
  if (isLoading) return <Skeleton className="h-80 rounded-xl" />
  if (!current) return <Card><EmptyState icon={ShieldCheck} title="Anda bukan wali kelas pada semester ini" /></Card>
  return (
    <div className="space-y-6">
      <PageHeader title={`Perlu Tindak Lanjut — Kelas ${current.name}`} description="Daftar dihitung otomatis: tugas lewat tenggat, nilai di bawah KKM, kuis terlewat, materi < 50%, dan tidak aktif lebih dari 7 hari.">
        <div className="mt-3"><ClassPicker classes={classes} current={current} onChange={setPicked} /></div>
      </PageHeader>
      <List key={current.id} cls={current} />
    </div>
  )
}
