import { cn } from '@/lib/utils'

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 scrollbar-thin', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
            value === t.value ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
          {t.count != null && (
            <span className={cn('rounded-full px-1.5 text-xs', value === t.value ? 'bg-primary-50 text-primary-700' : 'bg-slate-200 text-slate-600')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
