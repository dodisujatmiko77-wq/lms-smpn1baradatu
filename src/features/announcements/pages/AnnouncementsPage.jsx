import { PageHeader } from '@/components/ui'
import { AnnouncementList } from '../components/AnnouncementList'

/** Halaman Pengumuman (admin, guru, siswa). */
export default function AnnouncementsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Pengumuman" description="Pengumuman sekolah, kelas, dan mata pelajaran. Pengumuman baru dikirim sebagai notifikasi." />
      <AnnouncementList />
    </div>
  )
}
