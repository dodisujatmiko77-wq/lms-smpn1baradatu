import { GraduationCap } from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { cn } from '@/lib/utils'

export function SchoolLogo({ className, iconClassName }) {
  const { logo_url, short_name } = useSchoolSettings()
  if (logo_url) return <img src={logo_url} alt={`Logo ${short_name}`} className={cn('rounded-xl bg-white object-contain', className)} />
  return (
    <span className={cn('grid place-items-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 text-white', className)}>
      <GraduationCap className={cn('h-5 w-5', iconClassName)} />
    </span>
  )
}
