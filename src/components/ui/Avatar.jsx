import { cn, initials } from '@/lib/utils'

// Semua warna memenuhi kontras ≥ 4,5:1 dengan teks putih.
const PALETTE = ['bg-primary-600', 'bg-accent-700', 'bg-success-700', 'bg-violet-600', 'bg-sky-700', 'bg-rose-600']

function colorFor(name = '') {
  let sum = 0
  for (const ch of name) sum += ch.charCodeAt(0)
  return PALETTE[sum % PALETTE.length]
}

export function Avatar({ name, src, size = 'md', className, onError }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-20 w-20 text-2xl' }
  if (src) return <img src={src} alt={name} onError={onError} className={cn('shrink-0 rounded-full object-cover', sizes[size], className)} />
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
