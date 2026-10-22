import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const rkeys = {
  all: ['reports'],
  classes: ['reports', 'classes'],
  classSummary: (id) => ['reports', 'class-summary', id],
  taGrades: (id) => ['reports', 'ta-grades', id],
  learning: ['reports', 'learning'],
  assignments: (classId) => ['reports', 'assignments', classId],
  missing: (id) => ['reports', 'missing', id],
  followups: (id) => ['reports', 'followups', id],
  activity: (opts) => ['reports', 'activity', opts],
  teachers: (days) => ['reports', 'teachers', days],
  student: (id) => ['reports', 'student', id],
}

export const fetchReportClasses = async () => unwrap(await supabase.rpc('get_report_classes'))
export const fetchClassSummary = async (classId) => unwrap(await supabase.rpc('report_class_summary', { p_class_id: classId }))
export const fetchTaGrades = async (taId) => unwrap(await supabase.rpc('report_ta_grades', { p_ta_id: taId }))
export const fetchLearningMonitor = async () => unwrap(await supabase.rpc('monitor_learning'))
export const fetchAssignmentMonitor = async (classId = null) => unwrap(await supabase.rpc('monitor_assignments', { p_class_id: classId }))
export const fetchMissingStudents = async (id) => unwrap(await supabase.rpc('assignment_missing_students', { p_assignment_id: id }))
export const fetchFollowups = async (classId) => unwrap(await supabase.rpc('class_followups', { p_class_id: classId }))
export const fetchActivity = async ({ days = 30, classId = null, taId = null } = {}) =>
  unwrap(await supabase.rpc('activity_daily', { p_days: days, p_class_id: classId, p_ta_id: taId }))
export const fetchTeacherActivity = async (days = 30) => unwrap(await supabase.rpc('teacher_activity', { p_days: days }))
export const fetchStudentReport = async (id) => unwrap(await supabase.rpc('get_student_report', { p_student_id: id }))

/** Tabel silang siswa × mapel dari baris report_class_summary. */
export function pivotClassSummary(rows) {
  const subjects = []
  const seen = new Set()
  const students = new Map()
  for (const r of rows) {
    if (!seen.has(r.teaching_assignment_id)) {
      seen.add(r.teaching_assignment_id)
      subjects.push({ id: r.teaching_assignment_id, name: r.subject_name, code: r.subject_code, teacher: r.teacher_name })
    }
    if (!students.has(r.student_id)) students.set(r.student_id, { id: r.student_id, full_name: r.full_name, nisn: r.nisn, cells: {} })
    students.get(r.student_id).cells[r.teaching_assignment_id] = r
  }
  const list = [...students.values()].map((s) => {
    const vals = Object.values(s.cells).map((c) => c.overall_avg).filter((v) => v != null).map(Number)
    const done = Object.values(s.cells).reduce((n, c) => n + c.lessons_done, 0)
    const total = Object.values(s.cells).reduce((n, c) => n + c.lessons_total, 0)
    const missing = Object.values(s.cells).reduce((n, c) => n + c.task_missing, 0)
    return {
      ...s,
      avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
      progress: total ? Math.round((done / total) * 1000) / 10 : null,
      missing,
    }
  })
  return { subjects, students: list, kkm: rows[0]?.kkm ?? 75 }
}
