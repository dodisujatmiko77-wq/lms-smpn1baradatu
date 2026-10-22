import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { akeys, fetchAnnouncement } from '../api'
import { AnnouncementCard } from '../components/AnnouncementCard'

/** Satu pengumuman (tujuan tautan notifikasi). */
export default function AnnouncementPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: akeys.one(id), queryFn: () => fetchAnnouncement(id) })
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2" onClick={() => navigate(-1)}>Kembali</Button>
      {q.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
      ) : !q.data ? (
        <Card><EmptyState icon={Megaphone} title="Pengumuman tidak tersedia" description="Pengumuman ini sudah dihapus, belum tayang, atau tidak ditujukan untuk Anda." /></Card>
      ) : (
        <AnnouncementCard a={q.data} />
      )}
    </div>
  )
}
