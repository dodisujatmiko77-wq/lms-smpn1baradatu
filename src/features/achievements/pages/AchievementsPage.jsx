import { useQuery } from '@tanstack/react-query'
import { Award, Sparkles } from 'lucide-react'
import { Badge, Card, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { ProgressBar } from '@/features/classroom/components/status'
import { cn, formatDate } from '@/lib/utils'
import { bkeys, fetchMyAchievements } from '../api'
import { BadgeIcon } from '../components/BadgeIcon'

/** Badge pencapaian siswa (semester aktif). */
export default function AchievementsPage() {
  const q = useQuery({ queryKey: bkeys.mine, queryFn: fetchMyAchievements })
  const rows = q.data ?? []
  const earned = rows.filter((b) => b.earned).length

  return (
    <div className="space-y-6">
      <PageHeader title="Badge Saya" description="Badge dihitung otomatis dari aktivitas belajarmu semester ini: materi, tugas, kuis, dan diskusi." />
      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">Badge tersedia setelah semester aktif diatur sekolah.</Card>
      ) : (
        <>
          <Card className="flex items-center gap-4 p-5">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Award className="h-7 w-7" /></span>
            <div>
              <p className="font-display text-2xl font-semibold text-slate-900">{earned} / {rows.length}</p>
              <p className="text-sm text-slate-500">badge diraih semester ini</p>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((b) => (
              <Card key={b.code} className={cn('flex flex-col items-center p-5 text-center', !b.earned && 'bg-slate-50/50')}>
                <BadgeIcon badge={b} size="lg" />
                <p className="mt-3 font-semibold text-slate-900">{b.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">{b.description}</p>
                {b.earned ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    <Badge tone="green">Diraih {formatDate(b.awarded_at, 'd MMM yyyy')}</Badge>
                    {b.is_new && <Badge tone="orange"><Sparkles className="h-3 w-3" /> Baru!</Badge>}
                  </div>
                ) : (
                  <div className="mt-3 w-full max-w-48">
                    <ProgressBar value={(b.progress / b.target) * 100} />
                    <p className="mt-1 text-xs text-slate-500">{b.progress} / {b.target}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
