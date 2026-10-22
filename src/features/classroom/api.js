import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'
import { fileInfo, randomId, safeFileName } from '@/lib/files'

export const MATERIALS_BUCKET = 'materials'

export const ckeys = {
  all: ['classroom'],
  course: (taId) => ['classroom', 'course', taId],
  sections: (taId) => ['classroom', 'sections', taId],
  lessons: (taId) => ['classroom', 'lessons', taId],
  lesson: (id) => ['classroom', 'lesson', id],
  myCourses: ['classroom', 'my-courses'],
  myProgress: (taId) => ['classroom', 'my-progress', taId],
  progress: (taId) => ['classroom', 'progress', taId],
  lessonStats: (taId) => ['classroom', 'lesson-stats', taId],
  signed: (path, bucket) => ['classroom', 'signed', bucket, path],
}

export const fetchCourse = async (taId) => unwrap(await supabase.rpc('get_course', { p_ta_id: taId }))
export const fetchMyCourses = async () => unwrap(await supabase.rpc('get_my_courses'))
export const fetchMyTeaching = async () => unwrap(await supabase.rpc('get_my_teaching'))
export const fetchCourseProgress = async (taId) => unwrap(await supabase.rpc('get_course_progress', { p_ta_id: taId }))

export async function fetchLessonStats(taId) {
  const rows = unwrap(await supabase.rpc('get_lesson_stats', { p_ta_id: taId }))
  return new Map(rows.map((r) => [r.lesson_id, r]))
}

export async function fetchSections(taId) {
  return unwrap(await supabase.from('course_sections').select('*').eq('teaching_assignment_id', taId).order('position').order('created_at'))
}

export async function fetchLessons(taId) {
  return unwrap(
    await supabase
      .from('lessons')
      .select('id, section_id, meeting_number, title, summary, status, published_at, position, created_at, updated_at, lesson_materials(count)')
      .eq('teaching_assignment_id', taId)
      .order('meeting_number', { ascending: true, nullsFirst: false })
      .order('created_at'),
  ).map((l) => ({ ...l, material_count: l.lesson_materials[0]?.count ?? 0 }))
}

export async function fetchLesson(id) {
  return unwrap(
    await supabase
      .from('lessons')
      .select('*, lesson_materials(*)')
      .eq('id', id)
      .order('position', { referencedTable: 'lesson_materials' })
      .order('created_at', { referencedTable: 'lesson_materials' })
      .single(),
  )
}

/** Progress siswa yang sedang login (RLS: hanya miliknya) → Map lesson_id → baris. */
export async function fetchMyProgress(taId) {
  const rows = unwrap(await supabase.from('lesson_progress').select('lesson_id, status, last_viewed_at, completed_at').eq('teaching_assignment_id', taId))
  return new Map(rows.map((r) => [r.lesson_id, r]))
}

export const markProgress = async (lessonId, action) =>
  unwrap(await supabase.rpc('mark_lesson_progress', { p_lesson_id: lessonId, p_action: action }))

/** Unggah berkas materi lalu catat di lesson_materials; berkas dihapus lagi bila pencatatan gagal. */
export async function uploadMaterial({ taId, lessonId, file, title, position }) {
  const info = fileInfo(file.name)
  const path = `${taId}/${lessonId}/${randomId()}-${safeFileName(file.name)}`
  unwrap(await supabase.storage.from(MATERIALS_BUCKET).upload(path, file, { contentType: info?.mime ?? file.type, upsert: false }))
  const { data, error } = await supabase
    .from('lesson_materials')
    .insert({
      lesson_id: lessonId,
      type: info?.type ?? 'file',
      title,
      storage_path: path,
      file_name: file.name,
      mime_type: info?.mime ?? file.type,
      size_bytes: file.size,
      position,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(MATERIALS_BUCKET).remove([path])
    throw error
  }
  return data
}

export async function deleteMaterial(material) {
  unwrap(await supabase.from('lesson_materials').delete().eq('id', material.id))
  if (material.storage_path) await supabase.storage.from(MATERIALS_BUCKET).remove([material.storage_path])
}

/** Hapus pertemuan beserta berkas-berkasnya di storage. */
export async function deleteLesson(lessonId) {
  const mats = unwrap(await supabase.from('lesson_materials').select('storage_path').eq('lesson_id', lessonId).not('storage_path', 'is', null))
  unwrap(await supabase.from('lessons').delete().eq('id', lessonId))
  if (mats.length) await supabase.storage.from(MATERIALS_BUCKET).remove(mats.map((m) => m.storage_path))
}

/** Signed URL berlaku 1 jam (bucket materi bersifat privat). */
export async function signedUrl(path, download, bucket = MATERIALS_BUCKET) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error) throw error
  return data.signedUrl
}
