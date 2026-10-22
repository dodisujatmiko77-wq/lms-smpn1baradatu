import { cn } from '@/lib/utils'

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-primary-50 text-primary-700 ring-primary-600/10',
  orange: 'bg-accent-50 text-accent-700 ring-accent-600/10',
  green: 'bg-success-50 text-success-700 ring-success-600/10',
  red: 'bg-red-50 text-red-700 ring-red-600/10',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/10',
}

export function Badge({ tone = 'slate', className, children, dot }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
