import { CalendarDays } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { formatDate, greeting } from '@/lib/utils'

export function WelcomeBanner({ subtitle, children }) {
  const { profile } = useAuth()
  const { school_name } = useSchoolSettings()
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 p-6 text-white shadow-card sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-accent-400/25 blur-xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            {greeting()}, {firstName}! 👋
          </h2>
          <p className="mt-1.5 max-w-xl text-sm text-primary-100">{subtitle ?? school_name}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
