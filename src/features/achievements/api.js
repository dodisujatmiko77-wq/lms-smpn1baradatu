import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const bkeys = { mine: ['achievements', 'mine'] }

/** Hitung & ambil badge siswa (badge baru diberikan server sekaligus). */
export const fetchMyAchievements = async () => unwrap(await supabase.rpc('get_my_achievements'))
