import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ClipboardCheck, PartyPopper } from 'lucide-react'
import { Badge, Card, EmptyState, ErrorState, PageHeader, SkeletonRows } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { fetchGradingQueue, tkeys } from '../api'
import { DueLabel } from '../status'

/** Antrean pemeriksaan guru: tugas yang memiliki jawaban belum dinilai. */
export default function GradingQueuePage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: tkeys.queue, queryFn: fetchGradingQueue })
  const total = (data ?? []).reduce((n, r) => n + r.waiting, 0)
  return (
    <div className="space-y-6">
      <PageHeader title="Pemeriksaan" description={data ? `${total} jawaban menunggu dinilai di semua kelas Anda.` : 'Jawaban siswa yang menunggu dinilai.'} />
      <Card>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Semua jawaban sudah dinilai" description="Jawaban baru dari siswa akan muncul di sini." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((r) => (
              <li key={r.assignment_id}>
                <Link to={`/guru/kelas/${r.teaching_assignment_id}/tugas/${r.assignment_id}?tab=nilai`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: r.subject_color }}>
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-slate-900">{r.assignment_title}</p>
                    <p className="text-xs text-slate-500">{r.subject_name} · Kelas {r.class_name} · jawaban pertama {formatRelative(r.oldest_submitted_at)}</p>
                    <DueLabel dueAt={r.due_at} done />
                  </div>
                  <Badge tone="orange">{r.waiting} perlu dinilai</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
