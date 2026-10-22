import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const calkeys = {
  all: ['calendar'],
  range: (from, to) => ['calendar', from, to],
}

export const fetchCalendar = async (from, to) => unwrap(await supabase.rpc('get_my_calendar', { p_from: from, p_to: to }))
export const createEvent = async (row) => unwrap(await supabase.from('calendar_events').insert(row).select('id').single())
export const updateEvent = async (id, patch) => unwrap(await supabase.from('calendar_events').update(patch).eq('id', id))
export const deleteEvent = async (id) => unwrap(await supabase.from('calendar_events').delete().eq('id', id))

export const CATEGORIES = {
  holiday: { label: 'Libur', color: '#dc2626' },
  exam: { label: 'Ujian / asesmen', color: '#7c3aed' },
  activity: { label: 'Kegiatan', color: '#16a34a' },
  other: { label: 'Lainnya', color: '#64748b' },
}
