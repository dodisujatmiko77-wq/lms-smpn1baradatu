import { Award, BookOpen, CalendarClock, ClipboardList, Megaphone, TrendingUp } from 'lucide-react'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { UpcomingModules } from '../components/UpcomingModules'
import { WelcomeBanner } from '../components/WelcomeBanner'

const UPCOMING = [
  { icon: BookOpen, title: 'Materi & mata pelajaran', description: 'Belajar per pertemuan dan tandai selesai', stage: 3 },
  { icon: ClipboardList, title: 'Tugas & nilai', description: 'Kumpulkan tugas dan baca umpan balik guru', stage: 4 },
  { icon: TrendingUp, title: 'Kuis & ujian online', description: 'Kerjakan kuis langsung dari HP', stage: 5 },
  { icon: Award, title: 'Badge pencapaian', description: 'Rajin Belajar, Tepat Waktu, Materi Tuntas', stage: 6 },
]

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle="Semangat belajar hari ini! Ruang belajarmu sedang disiapkan oleh sekolah." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={CalendarClock} title="Jadwal hari ini" />
          <EmptyState icon={CalendarClock} title="Jadwal belum tersedia" description="Jadwal pelajaran kelasmu akan tampil setelah diatur oleh sekolah." />
        </Card>
        <Card>
          <CardHeader icon={Megaphone} title="Pengumuman" />
          <EmptyState icon={Megaphone} title="Belum ada pengumuman" description="Pengumuman sekolah dan kelas akan muncul di sini." />
        </Card>
      </div>

      <UpcomingModules items={UPCOMING} />
    </div>
  )
}
