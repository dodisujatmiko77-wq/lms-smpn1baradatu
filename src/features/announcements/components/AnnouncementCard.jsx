import { Link } from 'react-router-dom'
import { CalendarClock, Megaphone, MoreVertical, Pencil, Pin, Trash2 } from 'lucide-react'
import { Badge, Button, Dropdown, DropdownItem } from '@/components/ui'
import { RichContent } from '@/features/classroom/components/RichContent'
import { cn, formatDate, formatRelative } from '@/lib/utils'

const SCOPE_TONE = { school: 'blue', class: 'green', course: 'violet' }

/** Kartu pengumuman. compact = ringkas untuk dashboard (isi dipotong). */
export function AnnouncementCard({ a, compact = false, onEdit, onDelete }) {
  const manage = a.can_manage && (onEdit || onDelete)
  return (
    <article className={cn('rounded-xl border bg-white p-4 shadow-card sm:p-5', a.is_pinned && !a.is_expired ? 'border-accent-200' : 'border-slate-200/70')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', a.is_pinned ? 'bg-accent-50 text-accent-600' : 'bg-sky-50 text-sky-600')}>
          {a.is_pinned ? <Pin className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={SCOPE_TONE[a.scope]}>{a.target_label}</Badge>
            {a.is_scheduled && <Badge tone="orange"><CalendarClock className="h-3 w-3" /> Terjadwal {formatDate(a.publish_at, 'd MMM HH:mm')}</Badge>}
            {a.is_expired && <Badge tone="slate">Tidak tayang lagi</Badge>}
          </div>
          <h3 className="mt-1.5 font-semibold leading-snug text-slate-900">
            {compact ? <Link to={`/pengumuman/${a.id}`} className="hover:text-primary-700">{a.title}</Link> : a.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{a.author_name ?? 'Sekolah'} · {formatRelative(a.publish_at)}</p>
        </div>
        {manage && (
          <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi pengumuman"><MoreVertical className="h-4 w-4" /></Button>}>
            {onEdit && <DropdownItem icon={Pencil} onClick={() => onEdit(a)}>Ubah</DropdownItem>}
            {onDelete && <DropdownItem icon={Trash2} danger onClick={() => onDelete(a)}>Hapus</DropdownItem>}
          </Dropdown>
        )}
      </div>
      {a.body_html && (
        <div className={cn('mt-3 sm:pl-[52px]', compact && 'line-clamp-3')}>
          <RichContent html={a.body_html} className="text-sm" />
        </div>
      )}
    </article>
  )
}
