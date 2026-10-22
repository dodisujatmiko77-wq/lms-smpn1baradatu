import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { akeys, deleteAnnouncement, fetchAnnouncements, fetchTargets } from '../api'
import { AnnouncementCard } from './AnnouncementCard'
import { AnnouncementFormModal } from './AnnouncementFormModal'

/** Daftar pengumuman + kelola (bila punya hak). Dipakai di halaman Pengumuman & tab ruang kelas. */
export function AnnouncementList({ taId = null, defaultTarget, emptyText = 'Pengumuman yang Anda buat atau terima akan muncul di sini.' }) {
  const qc = useQueryClient()
  const targets = useQuery({ queryKey: akeys.targets, queryFn: fetchTargets })
  const canCreate = (targets.data ?? []).length > 0
  const q = useQuery({ queryKey: akeys.list({ taId, includeScheduled: canCreate }), queryFn: () => fetchAnnouncements({ taId, includeScheduled: canCreate }), enabled: !targets.isLoading })
  const [form, setForm] = useState(null) // 'new' | announcement
  const [remove, setRemove] = useState(null)
  const [busy, setBusy] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: akeys.all })
  const rows = q.data ?? []

  const doDelete = async () => {
    setBusy(true)
    try {
      await deleteAnnouncement(remove.id)
      toast.success('Pengumuman dihapus.')
      setRemove(null)
      refresh()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button icon={Plus} onClick={() => setForm('new')}>Buat pengumuman</Button>
        </div>
      )}
      {q.isLoading || targets.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Megaphone} title="Belum ada pengumuman" description={emptyText} action={canCreate && <Button icon={Plus} onClick={() => setForm('new')}>Buat pengumuman</Button>} /></Card>
      ) : (
        <div className="space-y-3">{rows.map((a) => <AnnouncementCard key={a.id} a={a} onEdit={setForm} onDelete={setRemove} />)}</div>
      )}
      {form && (
        <AnnouncementFormModal
          key={form === 'new' ? 'new' : form.id}
          open
          announcement={form === 'new' ? null : form}
          defaultTarget={defaultTarget}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        onConfirm={doDelete}
        loading={busy}
        title="Hapus pengumuman?"
        confirmLabel="Hapus"
        message={remove && `"${remove.title}" akan dihapus beserta notifikasinya. Tindakan ini tercatat di Audit Log.`}
      />
    </div>
  )
}
