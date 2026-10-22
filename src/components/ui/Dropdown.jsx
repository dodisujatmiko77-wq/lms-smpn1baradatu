import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Dropdown sederhana: menutup saat klik di luar atau tombol Esc. */
export function Dropdown({ trigger, children, align = 'right', className, panelClassName }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            'absolute z-40 mt-2 min-w-52 animate-slide-up rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
          onClick={(e) => e.target.closest('[data-close]') && setOpen(false)}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({ icon: Icon, children, onClick, danger, as: Comp = 'button', ...props }) {
  return (
    <Comp
      data-close
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100',
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
      {children}
    </Comp>
  )
}
