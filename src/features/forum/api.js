import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const fkeys = {
  all: ['forum'],
  topics: (taId) => ['forum', 'topics', taId],
  topic: (id) => ['forum', 'topic', id],
}

export const fetchTopics = async (taId) => unwrap(await supabase.rpc('get_course_topics', { p_ta_id: taId }))
export const fetchTopic = async (id) => unwrap(await supabase.rpc('get_topic', { p_topic_id: id }))

export const createTopic = async (row) => unwrap(await supabase.from('discussion_topics').insert(row).select('id').single())
export const updateTopic = async (id, patch) => unwrap(await supabase.from('discussion_topics').update(patch).eq('id', id).select('id').single())
export const deleteTopic = async (id) => {
  const rows = unwrap(await supabase.from('discussion_topics').delete().eq('id', id).select('id'))
  if (!rows.length) throw new Error('Topik yang sudah dibalas tidak dapat dihapus. Minta guru untuk menghapusnya.')
}

export const createReply = async (row) => unwrap(await supabase.from('discussion_replies').insert(row).select('id').single())
export const updateReply = async (id, patch) => unwrap(await supabase.from('discussion_replies').update(patch).eq('id', id).select('id').single())
export const deleteReply = async (id) => unwrap(await supabase.from('discussion_replies').delete().eq('id', id))
