import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/providers/ThemeProvider'
import { cn } from '@/lib/utils'

/** Tombol cepat beralih mode terang/gelap. */
export function ThemeToggle({ className }) {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn('rounded-lg p-2 text-slate-600 hover:bg-slate-100', className)}
      aria-label={dark ? 'Gunakan mode terang' : 'Gunakan mode gelap'}
      title={dark ? 'Mode terang' : 'Mode gelap'}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
