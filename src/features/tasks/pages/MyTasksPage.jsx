import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui'
import { fetchMyTasks, tkeys } from '../api'
import { TaskCard } from '../components/TaskCard'
import { studentTaskStatus } from '../status'

const GROUPS = {
  todo: ['todo', 'draft', 'missing', 'upcoming'],
  done: ['submitted', 'late'],
  graded: ['graded'],
}

/** Daftar tugas siswa. */
export default function MyTasksPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: tkeys.mine, queryFn: fetchMyTasks })
  const [tab, setTab] = useState('todo')
  const rows = (data ?? []).map((t) => ({ ...t, status: studentTaskStatus(t) }))
  const count = (g) => rows.filter((r) => GROUPS[g].includes(r.status)).length
  const list = rows.filter((r) => GROUPS[tab].includes(r.status))
  // Perlu dikerjakan: tenggat terdekat dulu; lainnya: terbaru dulu.
  list.sort((a, b) => (tab === 'todo' ? a.due_at.localeCompare(b.due_at) : b.due_at.localeCompare(a.due_at)))

  return (
    <div className="space-y-6">
      <PageHeader title="Tugas" description="Kerjakan sebelum tenggat. Waktu tenggat mengikuti jam server sekolah." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todo', label: 'Perlu dikerjakan', count: count('todo') },
          { value: 'done', label: 'Terkumpul', count: count('done') },
          { value: 'graded', label: 'Dinilai', count: count('graded') },
        ]}
      />
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={tab === 'todo' ? 'Tidak ada tugas yang perlu dikerjakan 🎉' : tab === 'done' ? 'Belum ada tugas terkumpul' : 'Belum ada tugas yang dinilai'}
            description={tab === 'todo' ? 'Tugas baru dari gurumu akan muncul di sini.' : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{list.map((t) => <TaskCard key={t.id} task={t} />)}</div>
      )}
    </div>
  )
}
