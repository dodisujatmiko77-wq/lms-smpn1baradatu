import { supabase } from '@/lib/supabase'

export async function fetchAdminStats() {
  const { data, error } = await supabase.rpc('admin_account_stats')
  if (error) throw error
  return data
}

export async function fetchRecentAudit(limit = 6) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity, entity_id, created_at, actor:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
