import { createContext, useContext, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { SCHOOL_DEFAULTS } from '@/config/schoolDefaults'

const SettingsContext = createContext(SCHOOL_DEFAULTS)

export const SCHOOL_SETTINGS_KEY = ['school_settings']

export async function fetchSchoolSettings() {
  const { data, error } = await supabase.from('school_settings').select('*').eq('id', true).maybeSingle()
  if (error) throw error
  return data
}

/** Konfigurasi sekolah terpusat — satu sumber untuk nama, logo, batas unggah, dll. */
export function SettingsProvider({ children }) {
  const { data } = useQuery({
    queryKey: SCHOOL_SETTINGS_KEY,
    queryFn: fetchSchoolSettings,
    staleTime: 10 * 60_000,
  })

  const settings = useMemo(() => {
    const merged = { ...SCHOOL_DEFAULTS, ...(data ?? {}) }
    merged.logo_url = merged.logo_path
      ? supabase.storage.from('public-assets').getPublicUrl(merged.logo_path).data.publicUrl
      : null
    return merged
  }, [data])

  useEffect(() => {
    document.title = `${settings.app_name} — ${settings.short_name}`
  }, [settings.app_name, settings.short_name])

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSchoolSettings() {
  return useContext(SettingsContext)
}
