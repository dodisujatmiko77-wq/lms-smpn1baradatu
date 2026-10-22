import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { akeys, fetchAnnouncements } from '../api'
import { AnnouncementCard } from './AnnouncementCard'

/** Pengumuman terbaru untuk dashboard / ruang kelas. hideWhenEmpty = tidak dirender bila kosong. */
export function AnnouncementsWidget({ taId = null, limit = 3, linkTo, hideWhenEmpty = false, title = 'Pengumuman' }) {
  const q = useQuery({ queryKey: akeys.list({ taId, limit }), queryFn: () => fetchAnnouncements({ taId, limit }) })
  const rows = q.data ?? []
  if (hideWhenEmpty && (q.isLoading || q.isError || rows.length === 0)) return null
  return (
    <Card>
      <CardHeader icon={Megaphone} title={title} action={linkTo && <Link to={linkTo} className="text-sm font-medium text-primary-600 hover:text-primary-700">Semua</Link>} />
      {q.isLoading ? (
        <SkeletonRows rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="Belum ada pengumuman" description="Pengumuman sekolah dan kelas akan muncul di sini." />
      ) : (
        <div className="space-y-3 p-3">{rows.map((a) => <AnnouncementCard key={a.id} a={a} compact />)}</div>
      )}
    </Card>
  )
}
