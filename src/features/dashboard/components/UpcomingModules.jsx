import { Card, CardHeader } from '@/components/ui'
import { STAGE_NAMES } from '@/config/navigation'
import { Rocket } from 'lucide-react'

/** Daftar modul yang akan aktif — informasi jujur, bukan data contoh. */
export function UpcomingModules({ items }) {
  return (
    <Card>
      <CardHeader icon={Rocket} title="Segera hadir di LMS" description="Modul berikut aktif bertahap sesuai roadmap pengembangan." />
      <ul className="divide-y divide-slate-100">
        {items.map(({ icon: Icon, title, description, stage }) => (
          <li key={title} className="flex items-start gap-3 px-5 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{title}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
            <span className="whitespace-nowrap rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
              T{stage} · {STAGE_NAMES[stage]}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
