import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className, tone = 'primary' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {Icon && (
        <div className="relative mb-4">
          <div
            className={cn(
              'absolute inset-0 scale-150 rounded-full blur-xl',
              tone === 'accent' ? 'bg-accent-100' : tone === 'danger' ? 'bg-red-100' : 'bg-primary-100',
            )}
          />
          <span
            className={cn(
              'relative grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-card',
              tone === 'accent' ? 'text-accent-500' : tone === 'danger' ? 'text-red-500' : 'text-primary-600',
            )}
          >
            <Icon className="h-6 w-6" />
          </span>
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
