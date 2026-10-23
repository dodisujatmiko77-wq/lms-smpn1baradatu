import { Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { DAYS, hhmm, todayDow } from '@/lib/academic'
import { cn } from '@/lib/utils'

/**
 * Tampilan jadwal mingguan (Senin–Sabtu). Responsif: 6 kolom di desktop, bertumpuk di HP.
 * subtitle(s): teks baris kedua tiap blok (default: guru · kelas).
 */
const defaultSubtitle = (s) => `${s.teacher_name} · ${s.class_name}`

export function WeekSchedule({ items, subtitle = defaultSubtitle, onAdd, onEdit, onDelete, highlightToday = true }) {
  const today = highlightToday ? todayDow() : null
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {DAYS.map((d) => {
        const list = items.filter((i) => i.day_of_week === d.value)
        const isToday = today === d.value
        return (
          <div key={d.value} className={cn('flex flex-col rounded-xl border bg-white', isToday ? 'border-primary-300 ring-2 ring-primary-500/20' : 'border-slate-200/70')}>
            <div className={cn('flex items-center justify-between rounded-t-xl px-3 py-2', isToday ? 'bg-primary-600 text-white' : 'bg-slate-50')}>
              <span className="text-sm font-semibold">{d.label}</span>
              {isToday ? <span className="text-[11px] font-medium text-primary-100">Hari ini</span> : <span className="text-xs text-slate-500">{list.length}</span>}
            </div>
            <ul className="flex-1 space-y-2 p-2">
              {list.length === 0 && <li className="px-1 py-3 text-center text-xs text-slate-500">Tidak ada jadwal</li>}
              {list.map((s) => (
                <li key={s.id} className="group relative overflow-hidden rounded-lg border border-slate-100 bg-white p-2.5 pl-3.5 shadow-sm">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: s.subject_color }} />
                  <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Clock className="h-3 w-3" /> {hhmm(s.start_time)}–{hhmm(s.end_time)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{s.subject_name}</p>
                  <p className="truncate text-xs text-slate-500">{subtitle(s)}</p>
                  {s.room && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><MapPin className="h-3 w-3" /> {s.room}</p>
                  )}
                  {(onEdit || onDelete) && (
                    <div className="absolute right-1 top-1 flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      {onEdit && (
                        <button onClick={() => onEdit(s)} className="rounded-md bg-white/90 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Ubah jadwal">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(s)} className="rounded-md bg-white/90 p-1 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Hapus jadwal">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {onAdd && (
              <button onClick={() => onAdd(d.value)} className="m-2 mt-0 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-medium text-slate-500 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700">
                <Plus className="h-3.5 w-3.5" /> Tambah
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
