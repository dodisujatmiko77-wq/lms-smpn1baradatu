import { clsx } from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export function cn(...inputs) {
  return clsx(inputs)
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function formatDate(value, pattern = 'd MMM yyyy') {
  if (!value) return '—'
  return format(new Date(value), pattern, { locale: localeId })
}

export function formatRelative(value) {
  if (!value) return '—'
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: localeId })
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}
