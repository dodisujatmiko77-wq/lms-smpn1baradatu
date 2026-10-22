import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass } from './Input'

export function SearchInput({ value, onChange, placeholder = 'Cari…', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cn(inputClass(false, true), 'h-10 pr-3.5')} />
    </div>
  )
}

export function FilterSelect({ value, onChange, children, className, label }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn(inputClass(false), 'h-10 pr-8', className)}>
      {children}
    </select>
  )
}
