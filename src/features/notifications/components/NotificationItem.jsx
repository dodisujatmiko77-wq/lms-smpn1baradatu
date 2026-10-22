import { Link } from 'react-router-dom'
import { AlarmClock, Award, Bell, BookOpen, BookOpenCheck, ClipboardList, Megaphone, MessagesSquare, Star } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'

export const NOTIF_TYPES = {
  material: { icon: BookOpen, cls: 'bg-primary-50 text-primary-600' },
  assignment: { icon: ClipboardList, cls: 'bg-accent-50 text-accent-600' },
  quiz: { icon: BookOpenCheck, cls: 'bg-violet-50 text-violet-600' },
  deadline: { icon: AlarmClock, cls: 'bg-red-50 text-red-600' },
  grade: { icon: Star, cls: 'bg-success-50 text-success-600' },
  announcement: { icon: Megaphone, cls: 'bg-sky-50 text-sky-600' },
  forum: { icon: MessagesSquare, cls: 'bg-pink-50 text-pink-600' },
  badge: { icon: Award, cls: 'bg-amber-50 text-amber-600' },
}

/** Satu baris notifikasi; klik → tandai dibaca lalu buka tautannya. */
export function NotificationItem({ item, onOpen, compact = false }) {
  const t = NOTIF_TYPES[item.type] ?? { icon: Bell, cls: 'bg-slate-100 text-slate-600' }
  const unread = !item.read_at
  const content = (
    <>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', t.cls)}>
        <t.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', unread ? 'font-semibold text-slate-900' : 'text-slate-700', compact && 'line-clamp-2')}>{item.title}</span>
        {item.body && <span className={cn('mt-0.5 block text-xs text-slate-500', compact && 'line-clamp-1')}>{item.body}</span>}
        <span className="mt-0.5 block text-[11px] text-slate-400">{formatRelative(item.notify_at)}</span>
      </span>
      {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label="Belum dibaca" />}
    </>
  )
  const cls = cn('flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-slate-50', unread && 'bg-primary-50/40')
  return item.link ? (
    <Link to={item.link} data-close onClick={() => onOpen(item)} className={cls}>{content}</Link>
  ) : (
    <button type="button" data-close onClick={() => onOpen(item)} className={cls}>{content}</button>
  )
}
