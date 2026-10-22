import { useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { BellOff, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, SkeletonRows, Tabs } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { fetchNotifications, markNotificationsRead, nkeys } from '../api'
import { NotificationItem } from '../components/NotificationItem'

const PAGE = 30

/** Semua notifikasi pengguna. */
export default function NotificationsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const q = useInfiniteQuery({
    queryKey: nkeys.page('all'),
    queryFn: ({ pageParam }) => fetchNotifications({ limit: PAGE, before: pageParam }),
    initialPageParam: null,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].id : undefined),
  })
  const rows = (q.data?.pages ?? []).flat()
  const unread = q.data?.pages?.[0]?.[0]?.unread_total ?? 0
  const list = filter === 'unread' ? rows.filter((r) => !r.read_at) : rows
  const refresh = () => qc.invalidateQueries({ queryKey: nkeys.all })

  const open = async (item) => {
    if (!item.read_at) {
      await markNotificationsRead([item.id]).catch(() => {})
      refresh()
    }
  }
  const readAll = async () => {
    try {
      const n = await markNotificationsRead()
      toast.success(`${n} notifikasi ditandai dibaca.`)
      refresh()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifikasi"
        description="Notifikasi lama yang sudah dibaca dihapus otomatis setelah 4 bulan."
        actions={unread > 0 && <Button variant="outline" icon={CheckCheck} onClick={readAll}>Tandai semua dibaca</Button>}
      />
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'Semua' },
          { value: 'unread', label: 'Belum dibaca', count: unread },
        ]}
      />
      <Card className="p-2">
        {q.isLoading ? (
          <SkeletonRows rows={6} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : list.length === 0 ? (
          <EmptyState icon={BellOff} title={filter === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Belum ada notifikasi'} />
        ) : (
          <div className="space-y-0.5">{list.map((n) => <NotificationItem key={n.id} item={n} onOpen={open} />)}</div>
        )}
        {q.hasNextPage && (
          <div className="p-2 text-center">
            <Button variant="ghost" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Muat lebih banyak</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
