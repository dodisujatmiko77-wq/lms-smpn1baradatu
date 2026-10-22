import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const akeys = {
  all: ['announcements'],
  list: (opts) => ['announcements', 'list', opts],
  one: (id) => ['announcements', 'one', id],
  targets: ['announcements', 'targets'],
}

export const fetchAnnouncements = async ({ taId = null, includeScheduled = false, limit = 50 } = {}) =>
  unwrap(await supabase.rpc('get_announcements', { p_ta_id: taId, p_include_scheduled: includeScheduled, p_limit: limit }))

export async function fetchAnnouncement(id) {
  const rows = unwrap(await supabase.rpc('get_announcements', { p_id: id, p_include_scheduled: true, p_limit: 1 }))
  return rows[0] ?? null
}

export const fetchTargets = async () => unwrap(await supabase.rpc('get_announcement_targets'))

export const createAnnouncement = async (row) => unwrap(await supabase.from('announcements').insert(row).select('id').single())
export const updateAnnouncement = async (id, patch) => unwrap(await supabase.from('announcements').update(patch).eq('id', id))
export const deleteAnnouncement = async (id) => unwrap(await supabase.from('announcements').delete().eq('id', id))

/** Kunci target untuk <select>: "school", "class:<id>", "course:<id>". */
export const targetKey = (t) => (t.scope === 'school' ? 'school' : `${t.scope}:${t.id}`)
export function targetFields(key) {
  if (key === 'school') return { scope: 'school', class_id: null, teaching_assignment_id: null }
  const [scope, id] = key.split(':')
  return scope === 'class' ? { scope, class_id: id, teaching_assignment_id: null } : { scope, class_id: null, teaching_assignment_id: id }
}
