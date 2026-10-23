import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, Lock, LockOpen, MessagesSquare, MoreVertical, Pencil, Pin, PinOff, Reply, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { Avatar, Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { cn, formatDate, formatRelative } from '@/lib/utils'
import { createReply, deleteReply, deleteTopic, fetchTopic, fkeys, updateReply, updateTopic } from '../api'
import { LinkifiedText } from '../components/LinkifiedText'
import { RoleTag } from '../components/RoleTag'
import { TopicFormModal } from '../components/TopicFormModal'

function Composer({ placeholder, autoFocus, onSubmit, onCancel, initial = '', submitLabel = 'Kirim' }) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    const ok = await onSubmit(text.trim())
    setBusy(false)
    if (ok && !initial) setText('')
  }
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && send()}
        rows={3}
        maxLength={3000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        className="block w-full rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Batal</Button>}
        <Button size="sm" icon={Send} loading={busy} disabled={!text.trim()} onClick={send}>{submitLabel}</Button>
      </div>
    </div>
  )
}

function ReplyItem({ r, topic, child, replyingTo, setReplyingTo, editing, setEditing, act, onAsk }) {
  const canDelete = r.is_mine || topic.can_moderate
  const canReply = !topic.is_locked || topic.can_moderate
  return (
    <div className={cn('flex gap-3', child && 'mt-3')}>
      <Avatar name={r.author_name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className={cn('rounded-xl px-3.5 py-2.5', r.is_hidden ? 'border border-dashed border-red-200 bg-red-50/40' : 'bg-slate-50')}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">{r.author_name ?? 'Pengguna'}</span>
            <RoleTag role={r.author_role} />
            {r.is_hidden && <Badge tone="red"><EyeOff className="h-3 w-3" /> Disembunyikan guru</Badge>}
          </div>
          {editing === r.id ? (
            <div className="mt-2">
              <Composer initial={r.body} autoFocus submitLabel="Simpan" onCancel={() => setEditing(null)} onSubmit={(body) => act(() => updateReply(r.id, { body }), 'Balasan diperbarui.', () => setEditing(null))} />
            </div>
          ) : (
            <LinkifiedText text={r.body} className="mt-1 text-sm text-slate-800" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 px-1 text-xs text-slate-500">
          <span title={formatDate(r.created_at, "d MMMM yyyy 'pukul' HH:mm")}>{formatRelative(r.created_at)}{r.edited_at && ' · diedit'}</span>
          {canReply && !child && <button className="font-medium hover:text-primary-600" onClick={() => setReplyingTo(replyingTo === r.id ? null : r.id)}>Balas</button>}
          {canReply && child && <button className="font-medium hover:text-primary-600" onClick={() => setReplyingTo(r.parent_id)}>Balas</button>}
          {r.is_mine && editing !== r.id && (!topic.is_locked || topic.can_moderate) && <button className="font-medium hover:text-primary-600" onClick={() => setEditing(r.id)}>Ubah</button>}
          {topic.can_moderate && (
            <button className="font-medium hover:text-primary-600" onClick={() => act(() => updateReply(r.id, { is_hidden: !r.is_hidden }), r.is_hidden ? 'Balasan ditampilkan lagi.' : 'Balasan disembunyikan dari siswa.')}>
              {r.is_hidden ? 'Tampilkan' : 'Sembunyikan'}
            </button>
          )}
          {canDelete && <button className="font-medium text-red-600 hover:text-red-700" onClick={() => onAsk({ kind: 'reply', id: r.id })}>Hapus</button>}
        </div>
      </div>
    </div>
  )
}

/** Satu topik diskusi beserta balasannya (semua peran). */
export default function TopicPage() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const q = useQuery({ queryKey: fkeys.topic(topicId), queryFn: () => fetchTopic(topicId), refetchInterval: 30_000 })
  const [replyingTo, setReplyingTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editTopic, setEditTopic] = useState(false)
  const [ask, setAsk] = useState(null) // { kind: 'topic' | 'reply', id }
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    q.refetch()
    qc.invalidateQueries({ queryKey: fkeys.all })
  }
  const act = async (fn, ok, after) => {
    try {
      await fn()
      if (ok) toast.success(ok)
      after?.()
      refresh()
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    }
  }

  if (q.isLoading) return <Skeleton className="mx-auto h-80 max-w-3xl rounded-xl" />
  if (q.isError) {
    return (
      <Card className="mx-auto max-w-3xl">
        {/tidak ditemukan|disembunyikan/i.test(q.error?.message ?? '') ? <EmptyState icon={MessagesSquare} title="Topik tidak tersedia" description={q.error.message} /> : <ErrorState error={q.error} onRetry={q.refetch} />}
      </Card>
    )
  }
  const t = q.data
  const backTo = profile?.student_id ? `/siswa/mapel/${t.teaching_assignment_id}?tab=diskusi` : `/guru/kelas/${t.teaching_assignment_id}?tab=diskusi`
  const top = t.replies.filter((r) => !r.parent_id)
  const children = (id) => t.replies.filter((r) => r.parent_id === id)
  const canReply = !t.is_locked || t.can_moderate
  const itemProps = { topic: t, replyingTo, setReplyingTo, editing, setEditing, act, onAsk: setAsk }

  const confirmDelete = async () => {
    setBusy(true)
    if (ask.kind === 'topic') {
      const ok = await act(() => deleteTopic(t.id), 'Topik dihapus.')
      if (ok) navigate(backTo, { replace: true })
    } else {
      await act(() => deleteReply(ask.id), 'Balasan dihapus.')
    }
    setBusy(false)
    setAsk(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Diskusi · {t.course_label}
      </Link>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={t.author_name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {t.is_pinned && <Badge tone="orange"><Pin className="h-3 w-3" /> Disematkan</Badge>}
              {t.is_locked && <Badge tone="slate"><Lock className="h-3 w-3" /> Dikunci</Badge>}
              {t.is_hidden && <Badge tone="red"><EyeOff className="h-3 w-3" /> Disembunyikan</Badge>}
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-slate-900">{t.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{t.author_name}</span>
              <RoleTag role={t.author_role} />
              <span>· {formatRelative(t.created_at)}{t.edited_at && ' · diedit'}</span>
            </p>
          </div>
          {(t.can_moderate || t.is_mine) && (
            <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi topik"><MoreVertical className="h-4 w-4" /></Button>}>
              {t.is_mine && (!t.is_locked || t.can_moderate) && <DropdownItem icon={Pencil} onClick={() => setEditTopic(true)}>Ubah topik</DropdownItem>}
              {t.can_moderate && (
                <>
                  <DropdownItem icon={t.is_pinned ? PinOff : Pin} onClick={() => act(() => updateTopic(t.id, { is_pinned: !t.is_pinned }), t.is_pinned ? 'Sematan dilepas.' : 'Topik disematkan.')}>{t.is_pinned ? 'Lepas sematan' : 'Sematkan'}</DropdownItem>
                  <DropdownItem icon={t.is_locked ? LockOpen : Lock} onClick={() => act(() => updateTopic(t.id, { is_locked: !t.is_locked }), t.is_locked ? 'Topik dibuka kembali.' : 'Topik dikunci — siswa tidak bisa membalas.')}>{t.is_locked ? 'Buka kunci' : 'Kunci topik'}</DropdownItem>
                  <DropdownItem icon={t.is_hidden ? Eye : EyeOff} onClick={() => act(() => updateTopic(t.id, { is_hidden: !t.is_hidden }), t.is_hidden ? 'Topik ditampilkan lagi.' : 'Topik disembunyikan dari siswa.')}>{t.is_hidden ? 'Tampilkan topik' : 'Sembunyikan topik'}</DropdownItem>
                </>
              )}
              {(t.can_moderate || (t.is_mine && t.reply_count === 0)) && <DropdownItem icon={Trash2} danger onClick={() => setAsk({ kind: 'topic', id: t.id })}>Hapus topik</DropdownItem>}
            </Dropdown>
          )}
        </div>
        <LinkifiedText text={t.body} className="mt-4 text-[15px] leading-relaxed text-slate-800" />
      </Card>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.replies.filter((r) => !r.is_hidden).length} balasan</h3>
        {top.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">Belum ada balasan. Jadilah yang pertama menanggapi!</p>
        ) : (
          top.map((r) => (
            <div key={r.id}>
              <ReplyItem r={r} {...itemProps} />
              <div className="ml-11 border-l-2 border-slate-100 pl-3">
                {children(r.id).map((c) => <ReplyItem key={c.id} r={c} child {...itemProps} />)}
                {replyingTo === r.id && (
                  <div className="mt-3">
                    <Composer
                      autoFocus
                      placeholder={`Balas ${r.author_name ?? ''}…`}
                      onCancel={() => setReplyingTo(null)}
                      onSubmit={(body) => act(() => createReply({ topic_id: t.id, parent_id: r.id, body }), null, () => setReplyingTo(null))}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <Card className="p-4">
        {canReply ? (
          <Composer placeholder="Tulis balasan…" onSubmit={(body) => act(() => createReply({ topic_id: t.id, body }))} />
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500"><Lock className="h-4 w-4" /> Topik ini dikunci guru. Balasan baru tidak dapat ditambahkan.</p>
        )}
      </Card>
      <p className="flex items-center gap-1.5 px-1 text-xs text-slate-500"><Reply className="h-3.5 w-3.5" /> Gunakan bahasa yang sopan. Guru dapat menyembunyikan tulisan yang tidak pantas.</p>

      {editTopic && <TopicFormModal open topic={t} taId={t.teaching_assignment_id} onClose={() => setEditTopic(false)} onSaved={() => { setEditTopic(false); refresh() }} />}
      <ConfirmDialog
        open={Boolean(ask)}
        onClose={() => setAsk(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title={ask?.kind === 'topic' ? 'Hapus topik?' : 'Hapus balasan?'}
        confirmLabel="Hapus"
        message={ask?.kind === 'topic' ? 'Topik beserta seluruh balasannya akan dihapus permanen.' : 'Balasan ini (dan tanggapan di bawahnya) akan dihapus permanen.'}
      />
    </div>
  )
}
