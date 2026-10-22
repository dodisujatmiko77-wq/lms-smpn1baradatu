import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { CURRENT_STAGE } from '@/config/navigation'
import { cn } from '@/lib/utils'

/**
 * Pencarian menu sesuai hak akses. Pencarian global konten (materi, tugas,
 * mapel) akan ditambahkan pada Tahap 6 dengan sumber yang sama.
 */
export function MenuSearch({ groups, className, autoFocus, onDone }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const items = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [groups])
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return items.filter((i) => i.label.toLowerCase().includes(term) || i.group?.toLowerCase().includes(term)).slice(0, 8)
  }, [q, items])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = (item) => {
    navigate(item.to)
    setQ('')
    setOpen(false)
    onDone?.()
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          if (e.key === 'Enter' && results[active]) go(results[active])
          if (e.key === 'Escape') inputRef.current?.blur()
        }}
        placeholder="Cari menu…"
        aria-label="Cari menu"
        className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-9 pr-14 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
        Ctrl K
      </kbd>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 z-40 mt-2 animate-slide-up rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-pop">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada menu yang cocok dengan “{q}”.</p>
          ) : (
            results.map((item, i) => (
              <button
                key={item.to}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
                  i === active ? 'bg-primary-50 text-primary-700' : 'text-slate-700',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.group && <span className="text-xs text-slate-400">{item.group}</span>}
                {item.stage > CURRENT_STAGE && <span className="text-[10px] text-slate-400">T{item.stage}</span>}
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-primary-400" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
