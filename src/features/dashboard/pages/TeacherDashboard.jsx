import { Link } from 'react-router-dom'
import { BookOpen, CalendarClock, ClipboardCheck, FileQuestion, MessagesSquare, School, UserRound } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState } from '@/components/ui'
import { UpcomingModules } from '../components/UpcomingModules'
import { WelcomeBanner } from '../components/WelcomeBanner'

const UPCOMING = [
  { icon: School, title: 'Kelas yang diajar & jadwal mengajar', description: 'Berdasarkan penugasan dari administrator', stage: 2 },
  { icon: BookOpen, title: 'Ruang kelas digital & materi', description: 'Bab, pertemuan, materi, dan progress siswa', stage: 3 },
  { icon: ClipboardCheck, title: 'Tugas & pemeriksaan', description: 'Penilaian dan umpan balik per siswa', stage: 4 },
  { icon: FileQuestion, title: 'Bank soal, kuis & ujian online', description: 'Penilaian otomatis soal objektif', stage: 5 },
  { icon: MessagesSquare, title: 'Forum diskusi & pengumuman kelas', description: 'Interaksi dengan siswa', stage: 6 },
]

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle="Siapkan pembelajaran digital untuk kelas-kelas Anda.">
        <Link to="/profil">
          <Button variant="accent" icon={UserRound}>
            Profil saya
          </Button>
        </Link>
      </WelcomeBanner>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={CalendarClock} title="Jadwal mengajar hari ini" />
          <EmptyState
            icon={CalendarClock}
            title="Jadwal belum tersedia"
            description="Jadwal mengajar akan tampil setelah administrator mengatur penugasan dan jadwal pelajaran (Tahap 2)."
          />
        </Card>
        <Card>
          <CardHeader icon={School} title="Kelas yang saya ajar" />
          <EmptyState
            icon={School}
            title="Belum ada penugasan mengajar"
            description="Kelas dan mata pelajaran Anda akan muncul di sini setelah ditetapkan oleh administrator."
          />
        </Card>
      </div>

      <UpcomingModules items={UPCOMING} />
    </div>
  )
}
