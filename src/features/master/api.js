import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

/** Semua query data master memakai prefix ini agar mudah di-invalidate bersama. */
export const MASTER = ['master']
export const keys = {
  years: [...MASTER, 'years'],
  classes: (yearId) => [...MASTER, 'classes', yearId],
  class: (id) => [...MASTER, 'class', id],
  subjects: [...MASTER, 'subjects'],
  teachers: [...MASTER, 'teachers'],
  teacherOptions: [...MASTER, 'teacher-options'],
  students: (params) => [...MASTER, 'students', params],
  assignments: (params) => [...MASTER, 'assignments', params],
  guardians: (semesterId) => [...MASTER, 'guardians', semesterId],
  classSchedule: (classId, semesterId) => [...MASTER, 'schedule', classId, semesterId],
  teacherSchedule: (teacherId, semesterId) => [...MASTER, 'teacher-schedule', teacherId, semesterId],
  stats: [...MASTER, 'stats'],
}

// ---------- Tahun pelajaran & semester ----------
export async function fetchYears() {
  const rows = unwrap(
    await supabase.from('academic_years').select('*, semesters(*)').order('start_date', { ascending: false }),
  )
  return rows.map((y) => ({ ...y, semesters: [...y.semesters].sort((a, b) => a.number - b.number) }))
}

// ---------- Kelas ----------
export async function fetchClasses(yearId, semesterId) {
  if (!yearId) return []
  const rows = unwrap(
    await supabase
      .from('classes')
      .select('*, class_enrollments(count), class_guardians(semester_id, teacher:teachers(id, profile:profiles(full_name)))')
      .eq('academic_year_id', yearId)
      .order('grade')
      .order('name'),
  )
  return rows.map((c) => {
    const g = c.class_guardians.find((x) => x.semester_id === semesterId)
    return {
      ...c,
      student_count: c.class_enrollments[0]?.count ?? 0,
      guardian: g ? { teacher_id: g.teacher.id, full_name: g.teacher.profile.full_name } : null,
    }
  })
}

// ---------- Mata pelajaran ----------
export async function fetchSubjects({ activeOnly = false } = {}) {
  let q = supabase.from('subjects').select('*').order('sort_order').order('name')
  if (activeOnly) q = q.eq('is_active', true)
  return unwrap(await q)
}

// ---------- Guru (opsi pilihan) ----------
export async function fetchTeacherOptions() {
  const rows = unwrap(await supabase.from('v_teachers').select('id, full_name, nip, is_active').order('full_name'))
  return rows
}

// ---------- Penugasan mengajar ----------
export const ASSIGNMENT_SELECT =
  'id, hours_per_week, semester_id, class:classes(id, name, grade), subject:subjects(id, code, name, color, sort_order), teacher:teachers(id, nip, profile:profiles(full_name)), schedules(count)'

export async function fetchAssignments({ semesterId, classId, teacherId }) {
  if (!semesterId) return []
  let q = supabase.from('teaching_assignments').select(ASSIGNMENT_SELECT).eq('semester_id', semesterId)
  if (classId) q = q.eq('class_id', classId)
  if (teacherId) q = q.eq('teacher_id', teacherId)
  const rows = unwrap(await q)
  return rows
    .map((r) => ({ ...r, schedule_count: r.schedules[0]?.count ?? 0 }))
    .sort(
      (a, b) =>
        a.class.grade - b.class.grade ||
        a.class.name.localeCompare(b.class.name) ||
        a.subject.sort_order - b.subject.sort_order ||
        a.subject.name.localeCompare(b.subject.name),
    )
}

// ---------- Jadwal ----------
export const SCHEDULE_SELECT =
  'id, day_of_week, start_time, end_time, room, teaching_assignment_id, ta:teaching_assignments!inner(id, class_id, teacher_id, semester_id, class:classes(name), subject:subjects(name, code, color), teacher:teachers(profile:profiles(full_name)))'

export async function fetchSchedules({ semesterId, classId, teacherId }) {
  if (!semesterId || (!classId && !teacherId)) return []
  let q = supabase.from('schedules').select(SCHEDULE_SELECT).eq('ta.semester_id', semesterId)
  if (classId) q = q.eq('ta.class_id', classId)
  if (teacherId) q = q.eq('ta.teacher_id', teacherId)
  const rows = unwrap(await q.order('day_of_week').order('start_time'))
  return rows.map((s) => ({
    id: s.id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    room: s.room,
    teaching_assignment_id: s.teaching_assignment_id,
    subject_name: s.ta.subject.name,
    subject_code: s.ta.subject.code,
    subject_color: s.ta.subject.color,
    class_name: s.ta.class.name,
    teacher_name: s.ta.teacher.profile.full_name,
  }))
}

export async function fetchSchoolStats() {
  return unwrap(await supabase.rpc('admin_school_stats'))
}
