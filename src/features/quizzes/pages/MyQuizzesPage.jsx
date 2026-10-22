import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck } from 'lucide-react'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui'
import { fetchMyQuizzes, qkeys } from '../api'
import { QuizCard } from '../components/QuizCard'
import { studentQuizStatus } from '../status'

const GROUPS = {
  active: ['in_progress', 'open', 'upcoming'],
  done: ['done', 'waiting', 'missed'],
}

/** Daftar kuis & ujian siswa. */
export default function MyQuizzesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: qkeys.mine, queryFn: fetchMyQuizzes })
  const [tab, setTab] = useState('active')
  const rows = (data ?? []).map((q) => ({ ...q, status: studentQuizStatus(q) }))
  const list = rows.filter((r) => GROUPS[tab].includes(r.status))
  const rank = { in_progress: 0, open: 1, upcoming: 2 }
  if (tab === 'active') list.sort((a, b) => rank[a.status] - rank[b.status] || a.open_at.localeCompare(b.open_at))

  return (
    <div className="space-y-6">
      <PageHeader title="Kuis & Ujian" description="Waktu buka, tutup, dan sisa waktu mengikuti jam server sekolah." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'Aktif & mendatang', count: rows.filter((r) => GROUPS.active.includes(r.status)).length },
          { value: 'done', label: 'Selesai', count: rows.filter((r) => GROUPS.done.includes(r.status)).length },
        ]}
      />
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpenCheck} title={tab === 'active' ? 'Tidak ada kuis aktif' : 'Belum ada kuis yang selesai'} description={tab === 'active' ? 'Kuis dan ujian dari gurumu akan muncul di sini.' : undefined} />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{list.map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
      )}
    </div>
  )
}
