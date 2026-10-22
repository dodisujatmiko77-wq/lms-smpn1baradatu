import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { supabase } from '@/lib/supabase'
import { fetchNotifications, nkeys } from './api'

const LIMIT = 8

/**
 * Notifikasi terbaru + jumlah belum dibaca.
 * Realtime (satu channel per pengguna) memicu muat ulang; bila realtime tidak
 * tersedia, data diperbarui berkala setiap 60 detik.
 */
export function useNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [live, setLive] = useState(false)
  const query = useQuery({
    queryKey: nkeys.latest,
    queryFn: () => fetchNotifications({ limit: LIMIT }),
    enabled: Boolean(user),
    refetchInterval: live ? 5 * 60_000 : 60_000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        qc.invalidateQueries({ queryKey: nkeys.all })
        if (payload.new?.title) toast.info(payload.new.title, { description: payload.new.body ?? undefined })
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc, user])

  const rows = query.data ?? []
  return { ...query, items: rows, unread: rows[0]?.unread_total ?? 0, live }
}
