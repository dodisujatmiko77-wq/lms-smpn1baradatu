import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Inbox, School, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, SkeletonRows, StatCard } from '@/components/ui'
import { TodaySchedule } from '@/features/schedules/components/TodaySchedule'
import { useActiveSemester } from '@/features/master/hooks'
import { fetchGradingQueue, tkeys } from '@/features/tasks/api'
import { fetchQuizGradingQueue, qkeys } from '@/features/quizzes/api'
import { unwrap } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { AnnouncementsWidget } from '@/features/announcements/components/AnnouncementsWidget'
import { WelcomeBanner } from '../components/WelcomeBanner'

async function fetchGuardianClasses(ids) {
  if (!ids.length) return []
  return unwrap(await supabase.from('classes').select('id, name').in('id', ids))
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const active = useActiveSemester()
  const teaching = useQuery({ queryKey: ['my-teaching'], queryFn: async () => unwrap(await supabase.rpc('get_my_teaching')) })
  const guardian = useQuery({ queryKey: ['my-guardian', profile.guardian_class_ids], queryFn: () => fetchGuardianClasses(profile.guardian_class_ids) })
  const queue = useQuery({ queryKey: tkeys.queue, queryFn: fetchGradingQueue })
  const quizQueue = useQuery({ queryKey: qkeys.queue, queryFn: fetchQuizGradingQueue })
  const waiting = [...(queue.data ?? []), ...(quizQueue.data ?? [])].reduce((n, q) => n + q.waiting, 0)
  const rows = teaching.data ?? []
  const classCount = new Set(rows.map((r) => r.class_id)).size
  const studentCount = [...new Map(rows.map((r) => [r.class_id, r.student_count])).values()].reduce((a, b) => a + b, 0)
  const hours = rows.reduce((n, r) => n + (r.hours_per_week ?? 0), 0)

  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle={active.label ? `Semester ${active.label}. Siapkan pembelajaran untuk kelas-kelas Anda.` : 'Semester aktif belum diatur oleh administrator.'}>
        <div className="flex flex-wrap gap-2">
          {(guardian.data ?? []).map((c) => (
            <Badge key={c.id} className="bg-white/20 text-white ring-white/30"><ShieldCheck className="h-3 w-3" /> Wali kelas {c.name}</Badge>
          ))}
          <Link to="/profil"><Button variant="accent" icon={UserRound}>Profil saya</Button></Link>
        </div>
      </WelcomeBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/guru/pemeriksaan" className="block">
          <StatCard label="Perlu dinilai" value={waiting} icon={Inbox} tone="violet" loading={queue.isLoading || quizQueue.isLoading} hint={waiting ? 'Buka antrean pemeriksaan →' : 'Semua jawaban sudah dinilai'} />
        </Link>
        <StatCard label="Kelas diajar" value={classCount} icon={School} tone="blue" loading={teaching.isLoading} hint={`${rows.length} kelas-mapel`} />
        <StatCard label="Jumlah siswa" value={studentCount} icon={Users} tone="orange" loading={teaching.isLoading} hint="Di seluruh kelas yang diajar" />
        <StatCard label="Jam per minggu" value={hours} icon={ClipboardCheck} tone="green" loading={teaching.isLoading} hint="Sesuai penugasan" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TodaySchedule isTeacher linkTo="/guru/jadwal" />
        <Card>
          <CardHeader icon={School} title="Kelas yang saya ajar" description={active.label ?? undefined} />
          {teaching.isLoading ? (
            <SkeletonRows rows={4} />
          ) : teaching.isError ? (
            <ErrorState error={teaching.error} onRetry={teaching.refetch} />
          ) : rows.length === 0 ? (
            <EmptyState icon={School} title="Belum ada penugasan mengajar" description="Kelas dan mapel Anda akan muncul setelah ditetapkan oleh administrator." />
          ) : (
            <ul className="grid gap-2 p-3 sm:grid-cols-2">
              {rows.map((r) => (
                <li key={r.teaching_assignment_id}>
                  <Link to={`/guru/kelas/${r.teaching_assignment_id}`} className="relative block overflow-hidden rounded-xl border border-slate-100 p-3 pl-4 transition hover:border-primary-200 hover:bg-primary-50/40">
                    <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: r.subject_color }} />
                    <p className="font-display text-base font-semibold text-slate-900">{r.class_name}</p>
                    <p className="truncate text-sm text-slate-600">{r.subject_name}</p>
                    <p className="mt-1 text-xs text-slate-400">{r.student_count} siswa · {r.schedule_count} sesi/minggu</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AnnouncementsWidget linkTo="/guru/pengumuman" />
    </div>
  )
}
