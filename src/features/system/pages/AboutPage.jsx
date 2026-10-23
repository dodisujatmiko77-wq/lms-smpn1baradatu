import { BarChart3, BookOpen, ClipboardCheck, Code2, FileQuestion, Info, Megaphone, ShieldCheck, Tag, UserRound } from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { SchoolLogo } from '@/components/layout/SchoolLogo'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { APP_INFO } from '@/config/app'

const FEATURES = [
  { icon: BookOpen, title: 'Materi pembelajaran', text: 'Bab dan pertemuan berisi teks, berkas, video YouTube, dan tautan.' },
  { icon: ClipboardCheck, title: 'Tugas & penilaian', text: 'Pengumpulan teks, dokumen, foto, atau tautan dengan nilai dan umpan balik.' },
  { icon: FileQuestion, title: 'Kuis & ujian online', text: 'Bank soal, waktu dari server, simpan otomatis, dan penilaian otomatis.' },
  { icon: Megaphone, title: 'Interaksi', text: 'Notifikasi, pengumuman, forum diskusi kelas, kalender, dan badge.' },
  { icon: BarChart3, title: 'Monitoring & laporan', text: 'Rekap nilai dan progres, daftar tindak lanjut, ekspor Excel/PDF.' },
  { icon: ShieldCheck, title: 'Keamanan data', text: 'Hak akses dijaga di database, berkas privat, dan audit log.' },
]

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="w-32 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

/** Informasi aplikasi: identitas, versi, dan pengembang. */
export default function AboutPage() {
  const { app_name, school_name, address } = useSchoolSettings()

  return (
    <div className="space-y-6">
      <PageHeader title="Tentang Aplikasi" description="Identitas, versi, dan pengembang LMS sekolah." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary-700 to-primary-500 px-5 pb-6 pt-7 text-white">
            <SchoolLogo className="h-16 w-16 bg-white p-1 shadow-lg" />
            <h3 className="mt-4 text-xl font-semibold text-white">{app_name}</h3>
            <p className="text-sm text-primary-100">{school_name}</p>
          </div>
          <CardBody className="divide-y divide-slate-100 py-1">
            <Row icon={Tag} label="Versi" value={APP_INFO.version} />
            <Row icon={Code2} label="Pengembang" value={APP_INFO.developer} />
            <Row icon={Info} label="Sekolah" value={address} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={UserRound} title="Pengembang" description="Perancang dan pembuat LMS Digital sekolah" />
          <CardBody>
            <p className="text-lg font-semibold text-slate-900">{APP_INFO.developer}</p>
            <p className="mt-1 text-sm text-slate-600">
              {app_name} dikembangkan oleh {APP_INFO.developer} untuk mendukung kegiatan belajar mengajar digital di {school_name}.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={Info} title="Fitur utama" />
        <CardBody>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{title}</span>
                  <span className="block text-sm text-slate-500">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
