import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { BookOpenCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button, Card, CardHeader, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CATEGORIES, calkeys, fetchCalendar } from '../api'
import { EventFormModal } from '../components/EventFormModal'

const ymd = (d) => format(d, 'yyyy-MM-dd')
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/** Pecah item kalender menjadi kemunculan per tanggal (yyyy-MM-dd). */
function occurrences(item) {
  if (item.kind === 'event') {
    const out = []
    for (let d = new Date(`${item.start_date}T00:00:00`); ymd(d) <= item.end_date; d = addDays(d, 1)) out.push({ day: ymd(d), item, note: null })
    return out
  }
  if (item.kind === 'assignment') return [{ day: ymd(new Date(item.start_at)), item, note: `Tenggat ${format(new Date(item.start_at), 'HH:mm')}` }]
  const open = ymd(new Date(item.start_at))
  const close = ymd(new Date(item.end_at))
  return open === close
    ? [{ day: open, item, note: `${format(new Date(item.start_at), 'HH:mm')}–${format(new Date(item.end_at), 'HH:mm')}` }]
    : [{ day: open, item, note: `Dibuka ${format(new Date(item.start_at), 'HH:mm')}` }, { day: close, item, note: `Ditutup ${format(new Date(item.end_at), 'HH:mm')}` }]
}

const colorOf = (it) => (it.kind === 'event' ? CATEGORIES[it.category]?.color : it.color) ?? '#64748b'
const Icon = ({ item, className }) => {
  const I = item.kind === 'assignment' ? ClipboardList : item.kind === 'quiz' ? BookOpenCheck : CalendarDays
  return <I className={className} />
}

function AgendaItem({ occ, onOpen }) {
  const it = occ.item
  return (
    <button type="button" onClick={() => onOpen(it)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: colorOf(it) }}>
        <Icon item={it} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium text-slate-900', it.done && 'text-slate-500 line-through')}>{it.title}</span>
        <span className="block text-xs text-slate-500">
          {[it.kind === 'event' ? CATEGORIES[it.category]?.label : null, it.subtitle, occ.note].filter(Boolean).join(' · ')}
        </span>
        {it.description && <span className="mt-0.5 block text-xs text-slate-500">{it.description}</span>}
      </span>
      {it.done && <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-label="Selesai" />}
    </button>
  )
}

/** Kalender pribadi: agenda sekolah/kelas, tenggat tugas, jadwal kuis. */
export default function CalendarPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { roles, profile } = useAuth()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => ymd(new Date()))
  const [form, setForm] = useState(null) // { event?, date }
  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const from = ymd(gridStart)
  const to = ymd(gridEnd)
  const q = useQuery({ queryKey: calkeys.range(from, to), queryFn: () => fetchCalendar(from, to) })
  const canAdd = roles.includes('admin') || (profile?.guardian_class_ids?.length ?? 0) > 0
  const today = ymd(new Date())

  const byDay = new Map()
  for (const it of q.data ?? []) {
    for (const o of occurrences(it)) {
      if (!byDay.has(o.day)) byDay.set(o.day, [])
      byDay.get(o.day).push(o)
    }
  }
  const days = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)
  const dayItems = byDay.get(selected) ?? []
  const open = (it) => (it.kind === 'event' ? it.can_edit && setForm({ event: it }) : it.link && navigate(it.link))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender"
        description="Agenda sekolah, tenggat tugas, dan jadwal kuis dalam satu tempat."
        actions={canAdd && <Button icon={Plus} onClick={() => setForm({ date: selected })}>Tambah agenda</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <Button variant="ghost" size="icon-sm" aria-label="Bulan sebelumnya" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-center">
              <p className="font-semibold capitalize text-slate-900">{format(month, 'MMMM yyyy', { locale: localeId })}</p>
              {!isSameMonth(month, new Date()) && <button className="text-xs font-medium text-primary-600" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(today) }}>Hari ini</button>}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Bulan berikutnya" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {q.isError ? (
            <ErrorState error={q.error} onRetry={q.refetch} />
          ) : (
            <div className="grid grid-cols-7">
              {DAYS.map((d) => <div key={d} className="border-b border-slate-100 py-2 text-center text-xs font-semibold text-slate-500">{d}</div>)}
              {days.map((d) => {
                const key = ymd(d)
                const items = byDay.get(key) ?? []
                const holiday = items.some((o) => o.item.kind === 'event' && o.item.category === 'holiday')
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    aria-label={`${format(d, 'd MMMM', { locale: localeId })}, ${items.length} agenda`}
                    aria-pressed={selected === key}
                    className={cn(
                      'min-h-14 border-b border-r border-slate-100 p-1 text-left align-top transition sm:min-h-24 sm:p-1.5',
                      !isSameMonth(d, month) && 'bg-slate-50/70 text-slate-400',
                      selected === key ? 'bg-primary-50/70' : 'hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-6 w-6 place-items-center rounded-full text-xs font-semibold',
                        key === today ? 'bg-primary-600 text-white' : holiday || d.getDay() === 0 ? 'text-red-600' : 'text-slate-700',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {q.isLoading ? null : (
                      <>
                        <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                          {items.slice(0, 4).map((o, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorOf(o.item) }} />)}
                        </span>
                        <span className="mt-1 hidden space-y-0.5 sm:block">
                          {items.slice(0, 3).map((o, i) => (
                            <span key={i} className={cn('block truncate rounded px-1 py-0.5 text-[11px] font-medium text-white', o.item.done && 'opacity-60')} style={{ backgroundColor: colorOf(o.item) }}>
                              {o.item.title}
                            </span>
                          ))}
                          {items.length > 3 && <span className="block px-1 text-[11px] text-slate-500">+{items.length - 3} lagi</span>}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader icon={CalendarDays} title={format(new Date(`${selected}T00:00:00`), 'EEEE, d MMMM yyyy', { locale: localeId })} />
            <div className="p-2">
              {q.isLoading ? (
                <Skeleton className="h-20 rounded-lg" />
              ) : dayItems.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-500">Tidak ada agenda pada tanggal ini.</p>
              ) : (
                dayItems.map((o, i) => <AgendaItem key={`${o.item.kind}-${o.item.id}-${i}`} occ={o} onOpen={open} />)
              )}
            </div>
          </Card>
          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Keterangan</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              {Object.values(CATEGORIES).map((c) => (
                <span key={c.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}</span>
              ))}
              <span className="col-span-2 flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Tugas & <BookOpenCheck className="h-3.5 w-3.5" /> kuis: warna mapel</span>
            </div>
          </Card>
        </div>
      </div>

      {form && (
        <EventFormModal
          key={form.event?.id ?? 'new'}
          open
          event={form.event}
          defaultDate={form.date ?? selected}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            qc.invalidateQueries({ queryKey: calkeys.all })
          }}
        />
      )}
    </div>
  )
}
