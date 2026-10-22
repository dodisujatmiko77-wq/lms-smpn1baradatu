import { Link } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { STAGE_NAMES } from '@/config/navigation'

/** Halaman informasi untuk menu yang dijadwalkan pada tahap pengembangan berikutnya. */
export default function ComingSoonPage({ title, stage, backTo }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-primary-50 via-white to-accent-50 px-6 py-14 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-accent-500 shadow-card">
          <Construction className="h-8 w-8" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary-600">
          Tahap {stage} · {STAGE_NAMES[stage]}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{title} segera hadir</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Modul ini sedang dalam rencana pengembangan dan akan aktif pada Tahap {stage}. Data yang ditampilkan nanti berasal langsung dari
          database sekolah.
        </p>
        <Link to={backTo} className="mt-6 inline-block">
          <Button variant="outline" icon={ArrowLeft}>
            Kembali ke dashboard
          </Button>
        </Link>
      </div>
    </Card>
  )
}
