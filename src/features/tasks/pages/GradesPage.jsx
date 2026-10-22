import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageSquareQuote, Star } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { fetchMyTasks, tkeys } from '../api'

/** Nilai tugas yang sudah diterbitkan guru, dikelompokkan per mata pelajaran. */
export default function GradesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: tkeys.mine, queryFn: fetchMyTasks })
  const graded = (data ?? []).filter((t) => t.score != null)
  const bySubject = [...new Set(graded.map((t) => t.subject_name))].map((name) => {
    const list = graded.filter((t) => t.subject_name === name)
    const avg = list.reduce((n, t) => n + (Number(t.score) / Number(t.max_score)) * 100, 0) / list.length
    return { name, color: list[0].subject_color, list, avg }
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Nilai & Umpan Balik" description="Nilai tugas yang sudah diterbitkan guru. Ini bukan rapor resmi." />
      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : graded.length === 0 ? (
        <Card><EmptyState icon={Star} title="Belum ada nilai" description="Nilai dan umpan balik akan muncul setelah guru menerbitkannya." /></Card>
      ) : (
        bySubject.map((s) => (
          <Card key={s.name}>
            <CardHeader
              title={s.name}
              description={`${s.list.length} tugas dinilai`}
              action={<span className="rounded-xl px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: s.color }}>Rata-rata {Math.round(s.avg)}</span>}
            />
            <ul className="divide-y divide-slate-100">
              {s.list.map((t) => (
                <li key={t.id}>
                  <Link to={`/siswa/tugas/${t.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{t.title}</p>
                      <p className="text-xs text-slate-500">Dinilai {formatDate(t.graded_at, 'd MMM yyyy')}</p>
                      {t.feedback && (
                        <p className="mt-2 flex gap-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">
                          <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {t.feedback}
                        </p>
                      )}
                    </div>
                    <p className="font-display text-2xl font-semibold text-slate-900">
                      {Number(t.score)}<span className="text-sm font-normal text-slate-400">/{Number(t.max_score)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
