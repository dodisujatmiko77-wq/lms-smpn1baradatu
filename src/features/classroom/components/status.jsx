import { CheckCircle2, CircleDashed, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

export const STUDENT_STATUS = {
  not_started: { label: 'Belum dimulai', tone: 'slate', icon: CircleDashed, color: 'text-slate-400' },
  in_progress: { label: 'Sedang dipelajari', tone: 'blue', icon: PlayCircle, color: 'text-primary-600' },
  completed: { label: 'Selesai', tone: 'green', icon: CheckCircle2, color: 'text-success-600' },
}

export function StudentStatusBadge({ status }) {
  const s = STUDENT_STATUS[status]
  return <Badge tone={s.tone}><s.icon className="h-3 w-3" /> {s.label}</Badge>
}

export function StudentStatusIcon({ status, className }) {
  const s = STUDENT_STATUS[status]
  return <s.icon className={cn('h-5 w-5 shrink-0', s.color, className)} />
}

export function PublishBadge({ status }) {
  return status === 'published' ? <Badge tone="green" dot>Terbit</Badge> : <Badge tone="orange" dot>Draf</Badge>
}

/** Progress bar sederhana (persen). */
export function ProgressBar({ value, className, tone = 'primary', label = 'Progress' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500', tone === 'white' ? 'bg-white' : pct === 100 ? 'bg-success-500' : 'bg-primary-500')} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Cincin progress untuk kartu mata pelajaran. */
export function ProgressRing({ value, size = 56, stroke = 6, color = '#1d4ed8' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-label={`${Math.round(pct)}% selesai`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? '#16a34a' : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} className="transition-all duration-700" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-slate-800 text-[13px] font-semibold" style={{ transformOrigin: 'center' }}>
        {Math.round(pct)}%
      </text>
    </svg>
  )
}
