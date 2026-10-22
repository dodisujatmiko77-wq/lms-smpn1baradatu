import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/AuthProvider'
import { semesterLabel } from '@/lib/academic'
import { MASTER, fetchClasses, fetchSubjects, fetchTeacherOptions, fetchYears, keys } from './api'

/** Semester & tahun pelajaran aktif (dari konteks login). */
export function useActiveSemester() {
  const { profile } = useAuth()
  const s = profile?.active_semester
  return {
    semesterId: s?.id ?? null,
    yearId: s?.academic_year_id ?? null,
    number: s?.number ?? null,
    label: s ? `${s.academic_year} · ${semesterLabel(s.number)}` : null,
  }
}

export const useYears = () => useQuery({ queryKey: keys.years, queryFn: fetchYears })

export function useClasses(yearId, semesterId) {
  return useQuery({ queryKey: [...keys.classes(yearId), semesterId], queryFn: () => fetchClasses(yearId, semesterId), enabled: Boolean(yearId) })
}

export const useSubjects = (opts) => useQuery({ queryKey: [...keys.subjects, opts], queryFn: () => fetchSubjects(opts) })

export const useTeacherOptions = () => useQuery({ queryKey: keys.teacherOptions, queryFn: fetchTeacherOptions })

/** Invalidasi seluruh data master (dipakai setelah perubahan yang berdampak luas). */
export function useInvalidateMaster() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: MASTER })
}
