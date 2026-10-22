import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, EyeOff, Lock, MessageSquare, MessagesSquare, Pin, Plus } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { cn, formatRelative } from '@/lib/utils'
import { fetchTopics, fkeys } from '../api'
import { RoleTag } from './RoleTag'
import { TopicFormModal } from './TopicFormModal'

/** Tab "Diskusi" di ruang kelas (guru & siswa). */
export function CourseForumTab({ taId }) {
  const navigate = useNavigate()
  const q = useQuery({ queryKey: fkeys.topics(taId), queryFn: () => fetchTopics(taId) })
  const [open, setOpen] = useState(false)
  const rows = q.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{rows.length}</span> topik diskusi</p>
        <Button icon={Plus} onClick={() => setOpen(true)}>Topik baru</Button>
      </div>
      <Card>
        {q.isLoading ? (
          <SkeletonRows rows={4} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="Belum ada diskusi" description="Mulai diskusi untuk bertanya tentang materi atau berbagi pendapat dengan teman sekelas." action={<Button icon={Plus} onClick={() => setOpen(true)}>Topik baru</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => (
              <li key={t.id}>
                <Link to={`/diskusi/${t.id}`} className={cn('flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5', t.is_hidden && 'opacity-60')}>
                  <Avatar name={t.author_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-medium text-slate-900">
                      {t.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-accent-600" aria-label="Disematkan" />}
                      {t.is_locked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-label="Dikunci" />}
                      <span className="truncate">{t.title}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{t.excerpt}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{t.author_name}</span>
                      <RoleTag role={t.author_role} />
                      <span>· aktif {formatRelative(t.last_activity_at)}</span>
                      {t.is_hidden && <Badge tone="red"><EyeOff className="h-3 w-3" /> Disembunyikan</Badge>}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm text-slate-500"><MessageSquare className="h-4 w-4" /> {t.reply_count}</span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && (
        <TopicFormModal
          open
          taId={taId}
          onClose={() => setOpen(false)}
          onSaved={(id) => {
            setOpen(false)
            navigate(`/diskusi/${id}`)
          }}
        />
      )}
    </div>
  )
}
