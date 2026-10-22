import { cn } from '@/lib/utils'
import { Skeleton } from './Skeleton'

const TONES = {
  blue: { wrap: 'from-primary-600 to-primary-500', ring: 'bg-white/15' },
  orange: { wrap: 'from-accent-500 to-amber-400', ring: 'bg-white/20' },
  green: { wrap: 'from-success-600 to-emerald-500', ring: 'bg-white/15' },
  violet: { wrap: 'from-violet-600 to-indigo-500', ring: 'bg-white/15' },
  slate: { wrap: 'from-slate-700 to-slate-600', ring: 'bg-white/10' },
}

/** Kartu statistik berwarna untuk dashboard. */
export function StatCard({ label, value, icon: Icon, tone = 'blue', hint, loading }) {
  const t = TONES[tone] ?? TONES.blue
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-gradient-to-br p-5 text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover',
        t.wrap,
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 right-8 h-20 w-20 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/85">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16 bg-white/25" />
          ) : (
            <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{value}</p>
          )}
        </div>
        {Icon && (
          <span className={cn('grid h-11 w-11 place-items-center rounded-xl', t.ring)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {hint && <p className="relative mt-3 text-xs text-white/80">{hint}</p>}
    </div>
  )
}
