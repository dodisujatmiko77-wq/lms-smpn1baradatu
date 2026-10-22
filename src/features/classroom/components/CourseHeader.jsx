import { Link } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Users } from 'lucide-react'
import { semesterLabel } from '@/lib/academic'

/** Banner ruang kelas digital dengan warna mapel. */
export function CourseHeader({ course, backTo, backLabel, children }) {
  return (
    <div className="space-y-4">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-card sm:p-7" style={{ background: `linear-gradient(135deg, ${course.subject_color}, ${course.subject_color}cc 60%, #1e3a8a)` }}>
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-28 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">
              Kelas {course.class_name} · {course.academic_year} {semesterLabel(course.semester_number)}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">{course.subject_name}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
              <span className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> {course.teacher_name}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {course.student_count} siswa</span>
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
