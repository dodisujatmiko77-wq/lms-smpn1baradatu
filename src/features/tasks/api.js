import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'
import { fileInfo, randomId, safeFileName } from '@/lib/files'

/** Bucket privat untuk lampiran tugas & berkas jawaban siswa. */
export const TASK_BUCKET = 'assignment-files'

export const tkeys = {
  all: ['tasks'],
  course: (taId) => ['tasks', 'course', taId],
  task: (id) => ['tasks', 'task', id],
  board: (id) => ['tasks', 'board', id],
  mine: ['tasks', 'mine'],
  mySubmission: (id) => ['tasks', 'my-submission', id],
  queue: ['tasks', 'queue'],
}

// ---------- Guru ----------
export const fetchCourseTasks = async (taId) => unwrap(await supabase.rpc('get_course_assignments', { p_ta_id: taId }))
export const fetchTask = async (id) => unwrap(await supabase.from('assignments').select('*').eq('id', id).single())
export const fetchBoard = async (id) => unwrap(await supabase.rpc('get_assignment_board', { p_assignment_id: id }))
export const fetchGradingQueue = async () => unwrap(await supabase.rpc('get_grading_queue'))

export async function createTask(row) {
  return unwrap(await supabase.from('assignments').insert(row).select('id').single())
}

export async function updateTask(id, patch) {
  return unwrap(await supabase.from('assignments').update(patch).eq('id', id).select().single())
}

/** Unggah lampiran guru lalu tambahkan ke kolom attachments. */
export async function uploadTaskAttachment(task, file, title) {
  const info = fileInfo(file.name)
  const path = `${task.teaching_assignment_id}/${task.id}/lampiran/${randomId()}-${safeFileName(file.name)}`
  unwrap(await supabase.storage.from(TASK_BUCKET).upload(path, file, { contentType: info?.mime ?? file.type }))
  const att = { id: randomId(), type: info?.type ?? 'file', title, storage_path: path, file_name: file.name, mime_type: info?.mime ?? file.type, size_bytes: file.size }
  const fresh = await fetchTask(task.id)
  try {
    await updateTask(task.id, { attachments: [...fresh.attachments, att] })
  } catch (e) {
    await supabase.storage.from(TASK_BUCKET).remove([path])
    throw e
  }
}

export async function addTaskLink(task, { type, url, title }) {
  const fresh = await fetchTask(task.id)
  await updateTask(task.id, { attachments: [...fresh.attachments, { id: randomId(), type, url, title }] })
}

export async function removeTaskAttachment(task, att) {
  const fresh = await fetchTask(task.id)
  await updateTask(task.id, { attachments: fresh.attachments.filter((a) => a.id !== att.id) })
  if (att.storage_path) await supabase.storage.from(TASK_BUCKET).remove([att.storage_path])
}

/** Hapus tugas beserta lampiran & berkas jawaban siswa di storage. */
export async function deleteTask(task) {
  const subs = unwrap(await supabase.from('assignment_submissions').select('files').eq('assignment_id', task.id))
  const paths = [...task.attachments, ...subs.flatMap((s) => s.files)].map((f) => f.storage_path).filter(Boolean)
  unwrap(await supabase.from('assignments').delete().eq('id', task.id))
  if (paths.length) await supabase.storage.from(TASK_BUCKET).remove(paths)
}

export async function saveGrade({ assignmentId, studentId, score, feedback }) {
  return unwrap(
    await supabase
      .from('assignment_grades')
      .upsert({ assignment_id: assignmentId, student_id: studentId, score, feedback: feedback || null }, { onConflict: 'assignment_id,student_id' })
      .select()
      .single(),
  )
}

export const publishGrades = async (assignmentId, studentIds = null) =>
  unwrap(await supabase.rpc('publish_grades', { p_assignment_id: assignmentId, p_student_ids: studentIds }))

// ---------- Siswa ----------
export const fetchMyTasks = async () => unwrap(await supabase.rpc('get_my_assignments'))

export async function fetchMySubmission(assignmentId) {
  return unwrap(await supabase.from('assignment_submissions').select('*').eq('assignment_id', assignmentId).maybeSingle())
}

export async function uploadSubmissionFile({ task, studentId, file }) {
  const info = fileInfo(file.name)
  const path = `${task.teaching_assignment_id}/${task.id}/siswa/${studentId}/${randomId()}-${safeFileName(file.name)}`
  unwrap(await supabase.storage.from(TASK_BUCKET).upload(path, file, { contentType: info?.mime ?? file.type }))
  return { storage_path: path, file_name: file.name, mime_type: info?.mime ?? file.type, size_bytes: file.size, type: info?.type ?? 'file' }
}

export const removeSubmissionFile = async (path) => unwrap(await supabase.storage.from(TASK_BUCKET).remove([path]))

/** action: 'save' | 'submit' | 'unsubmit' — validasi tenggat dilakukan server. */
export async function saveSubmission(assignmentId, action, { text = null, link = null, files = [] } = {}) {
  return unwrap(
    await supabase.rpc('save_submission', { p_assignment_id: assignmentId, p_action: action, p_text: text, p_link: link, p_files: files }),
  )
}
