import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ckeys, fetchCourse, fetchLessons, fetchSections } from './api'

export function useCourse(taId) {
  const course = useQuery({ queryKey: ckeys.course(taId), queryFn: () => fetchCourse(taId) })
  const sections = useQuery({ queryKey: ckeys.sections(taId), queryFn: () => fetchSections(taId), enabled: Boolean(course.data) })
  const lessons = useQuery({ queryKey: ckeys.lessons(taId), queryFn: () => fetchLessons(taId), enabled: Boolean(course.data) })
  return { course, sections, lessons }
}

export function useInvalidateClassroom() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ckeys.all })
}

/** Kelompokkan pertemuan per bab (urut posisi bab); pertemuan tanpa bab di akhir. */
export function groupLessons(sections = [], lessons = []) {
  const groups = sections.map((s) => ({ section: s, lessons: lessons.filter((l) => l.section_id === s.id) }))
  const loose = lessons.filter((l) => !l.section_id || !sections.some((s) => s.id === l.section_id))
  if (loose.length) groups.push({ section: null, lessons: loose })
  return groups
}

/** Status belajar siswa untuk satu pertemuan. */
export function lessonStudentStatus(progress) {
  if (!progress) return 'not_started'
  return progress.status === 'completed' ? 'completed' : 'in_progress'
}
