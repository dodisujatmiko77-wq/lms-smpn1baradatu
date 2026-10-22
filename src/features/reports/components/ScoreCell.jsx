import { cn } from '@/lib/utils'

export const fmt = (v, digits = 1) => (v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits }))

/** Nilai 0–100; merah bila di bawah KKM. */
export function ScoreCell({ value, kkm, muted, className }) {
  if (value == null) return <span className="text-slate-300">–</span>
  const low = kkm != null && Number(value) < kkm
  return <span className={cn('font-semibold tabular-nums', low ? 'text-red-600' : 'text-slate-900', muted && 'font-normal text-slate-500', className)}>{fmt(value)}</span>
}

/** Persen penyelesaian dengan bar kecil. */
export function PercentBar({ value }) {
  if (value == null) return <span className="text-slate-300">–</span>
  const v = Math.max(0, Math.min(100, Number(value)))
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className={cn('block h-full rounded-full', v >= 75 ? 'bg-success-500' : v >= 50 ? 'bg-primary-500' : 'bg-accent-500')} style={{ width: `${v}%` }} />
      </span>
      <span className="text-xs tabular-nums text-slate-600">{fmt(v, 0)}%</span>
    </span>
  )
}
