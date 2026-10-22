import { cn, initials } from '@/lib/utils'

const PALETTE = ['bg-primary-600', 'bg-accent-500', 'bg-success-600', 'bg-violet-600', 'bg-sky-600', 'bg-rose-500']

function colorFor(name = '') {
  let sum = 0
  for (const ch of name) sum += ch.charCodeAt(0)
  return PALETTE[sum % PALETTE.length]
}

export function Avatar({ name, src, size = 'md', className }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-20 w-20 text-2xl' }
  if (src) return <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size], className)} />
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold text-white',
        colorFor(name),
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials(name) || '?'}
    </span>
  )
}
