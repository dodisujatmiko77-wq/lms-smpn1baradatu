import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, ClipboardList, Library, Megaphone, TrendingUp } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Card, CardHeader, EmptyState, SkeletonRows } from '@/components/ui'
import { useActiveSemester } from '@/features/master/hooks'
import { fetchMySchedule } from '@/features/schedules/pages/MySchedulePage'
import { TodaySchedule } from '@/features/schedules/components/TodaySchedule'
import { UpcomingModules } from '../components/UpcomingModules'
import { WelcomeBanner } from '../components/WelcomeBanner'

const UPCOMING = [
  { icon: BookOpen, title: 'Materi & ruang kelas', description: 'Belajar per pertemuan dan tandai selesai', stage: 3 },
  { icon: ClipboardList, title: 'Tugas & nilai', description: 'Kumpulkan tugas dan baca umpan balik guru', stage: 4 },
  { icon: TrendingUp, title: 'Kuis & ujian online', description: 'Kerjakan kuis langsung dari HP', stage: 5 },
  { icon: Award, title: 'Badge pencapaian', description: 'Rajin Belajar, Tepat Waktu, Materi Tuntas', stage: 6 },
]

export default function StudentDashboard() {
  const { profile } = useAuth()
  const active = useActiveSemester()
  const schedule = useQuery({ queryKey: ['my-schedule'], queryFn: fetchMySchedule })
  const subjects = [...new Map((schedule.data ?? []).map((s) => [s.teaching_assignment_id, s])).values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name))
  const cls = profile.student_class

  return (
    <div className="space-y-6">
      <WelcomeBanner
        subtitle={cls ? `Kelas ${cls.name} · ${active.label}. Semangat belajar hari ini!` : 'Kamu belum ditempatkan di kelas. Hubungi wali kelas atau operator sekolah.'}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaySchedule linkTo="/siswa/jadwal" />
        </div>
        <Card>
          <CardHeader icon={Megaphone} title="Pengumuman" />
          <EmptyState icon={Megaphone} title="Belum ada pengumuman" description="Pengumuman sekolah dan kelas akan muncul di sini (Tahap 6)." />
        </Card>
      </div>

      <Card>
        <CardHeader icon={Library} title="Mata pelajaran kelasku" description={cls ? `Kelas ${cls.name}` : undefined} />
        {schedule.isLoading ? (
          <SkeletonRows rows={3} />
        ) : subjects.length === 0 ? (
          <EmptyState icon={Library} title="Belum ada mata pelajaran" description="Daftar mapel dan guru tampil setelah jadwal kelasmu disusun." />
        ) : (
          <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <li key={s.teaching_assignment_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: s.subject_color }}>
                  {s.subject_code.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.subject_name}</p>
                  <p className="truncate text-xs text-slate-500">{s.teacher_name}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UpcomingModules items={UPCOMING} />
    </div>
  )
}
