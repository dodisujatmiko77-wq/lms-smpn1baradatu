import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import { Card, CardHeader, ErrorState, SkeletonRows } from '@/components/ui'
import { bkeys, fetchMyAchievements } from '../api'
import { BadgeIcon } from './BadgeIcon'

/** Ringkasan badge untuk beranda siswa. */
export function BadgesCard() {
  const q = useQuery({ queryKey: bkeys.mine, queryFn: fetchMyAchievements })
  const rows = q.data ?? []
  const earned = rows.filter((b) => b.earned)
  return (
    <Card>
      <CardHeader icon={Award} title="Badge pencapaian" description={rows.length ? `${earned.length} dari ${rows.length} badge semester ini` : undefined} action={<Link to="/siswa/pencapaian" className="text-sm font-medium text-primary-600 hover:text-primary-700">Semua</Link>} />
      {q.isLoading ? (
        <SkeletonRows rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500">Badge tersedia setelah semester aktif diatur sekolah.</p>
      ) : (
        <div className="flex flex-wrap gap-3 p-4">
          {rows.map((b) => (
            <span key={b.code} title={`${b.name} — ${b.description}${b.earned ? '' : ` (${b.progress}/${b.target})`}`}>
              <BadgeIcon badge={b} size="sm" />
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
