import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { Dropdown, EmptyState, SkeletonRows } from '@/components/ui'
import { markNotificationsRead, nkeys } from '../api'
import { useNotifications } from '../useNotifications'
import { NotificationItem } from './NotificationItem'

/** Lonceng notifikasi di header. */
export function NotificationBell() {
  const qc = useQueryClient()
  const { items, unread, isLoading } = useNotifications()
  const refresh = () => qc.invalidateQueries({ queryKey: nkeys.all })
  const open = async (item) => {
    if (!item.read_at) {
      await markNotificationsRead([item.id]).catch(() => {})
      refresh()
    }
  }
  const readAll = async () => {
    await markNotificationsRead().catch(() => {})
    refresh()
  }

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button onClick={toggle} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}
      panelClassName="w-[min(24rem,calc(100vw-5rem))]"
    >
      <div className="flex items-center justify-between gap-2 px-2.5 pb-1.5 pt-1">
        <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
        {unread > 0 && (
          <button onClick={readAll} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
            <CheckCheck className="h-3.5 w-3.5" /> Tandai semua dibaca
          </button>
        )}
      </div>
      <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <SkeletonRows rows={3} />
        ) : items.length === 0 ? (
          <EmptyState icon={BellOff} title="Belum ada notifikasi" description="Materi, tugas, kuis, nilai, pengumuman, dan diskusi baru akan muncul di sini." className="py-6" />
        ) : (
          items.map((n) => <NotificationItem key={n.id} item={n} onOpen={open} compact />)
        )}
      </div>
      <div className="mt-1 border-t border-slate-100 pt-1">
        <Link to="/notifikasi" data-close className="block rounded-lg px-2.5 py-2 text-center text-sm font-medium text-primary-600 hover:bg-slate-50">
          Lihat semua notifikasi
        </Link>
      </div>
    </Dropdown>
  )
}
