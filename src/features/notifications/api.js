import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const nkeys = {
  all: ['notifications'],
  latest: ['notifications', 'latest'],
  page: (filter) => ['notifications', 'page', filter],
}

export const fetchNotifications = async ({ limit = 20, before = null } = {}) =>
  unwrap(await supabase.rpc('get_my_notifications', { p_limit: limit, p_before: before }))

/** ids null = tandai semua dibaca. */
export const markNotificationsRead = async (ids = null) => unwrap(await supabase.rpc('mark_notifications_read', { p_ids: ids }))
