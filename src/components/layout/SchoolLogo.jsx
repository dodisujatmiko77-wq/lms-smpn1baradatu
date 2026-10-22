import { useState } from 'react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { cn } from '@/lib/utils'

/** Logo bawaan aplikasi; dipakai bila admin belum mengunggah logo di Pengaturan Sekolah. */
export const DEFAULT_LOGO = '/brand/logo-256.webp'

export function SchoolLogo({ className }) {
  const { logo_url, short_name } = useSchoolSettings()
  const [failed, setFailed] = useState(false)
  const src = !logo_url || failed ? DEFAULT_LOGO : logo_url
  return (
    <img
      src={src}
      alt={`Logo ${short_name}`}
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-xl object-contain', className)}
      draggable={false}
    />
  )
}
