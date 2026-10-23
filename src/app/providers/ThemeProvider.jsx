import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'lms-theme'
const THEME_COLORS = { light: '#1d4ed8', dark: '#0b1220' }
const ThemeContext = createContext(null)

function readPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Tema tampilan: terang, gelap, atau mengikuti pengaturan perangkat. Disimpan per perangkat. */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readPreference)
  const [prefersDark, setPrefersDark] = useState(systemDark)
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
  }, [resolved])

  const setTheme = useCallback((value) => {
    setThemeState(value)
    try {
      if (value === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Penyimpanan diblokir (mode privat): tema tetap berlaku sampai halaman ditutup.
    }
  }, [])

  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme])
  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider')
  return ctx
}
