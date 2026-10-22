import { AlarmClockCheck, Award, BookOpenCheck, Footprints, GraduationCap, MessagesSquare, Swords, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS = { AlarmClockCheck, BookOpenCheck, Footprints, GraduationCap, MessagesSquare, Swords, Trophy }

/** Lencana bulat; abu-abu bila belum diraih. */
export function BadgeIcon({ badge, size = 'md' }) {
  const I = ICONS[badge.icon] ?? Award
  const dim = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  const icon = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full ring-4', dim, badge.earned ? 'text-white ring-white shadow-card' : 'bg-slate-100 text-slate-400 ring-slate-50')}
      style={badge.earned ? { background: `linear-gradient(135deg, ${badge.color}, ${badge.color}bb)` } : undefined}
    >
      <I className={icon} />
    </span>
  )
}
