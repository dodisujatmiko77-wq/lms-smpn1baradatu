import { GraduationCap, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'student', label: 'Siswa', icon: UserRound },
  { value: 'teacher', label: 'Guru', icon: GraduationCap },
  { value: 'admin', label: 'Administrator', icon: ShieldCheck },
]

export function RoleCheckboxes({ value = [], onChange, error }) {
  const toggle = (role) => onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role])
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">
        Role<span className="ml-0.5 text-red-500">*</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value: v, label, icon: Icon }) => {
          const checked = value.includes(v)
          return (
            <button
              type="button"
              key={v}
              onClick={() => toggle(v)}
              aria-pressed={checked}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition',
                checked ? 'border-primary-500 bg-primary-50 text-primary-700 ring-4 ring-primary-500/10' : 'border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">Wali kelas ditetapkan dari menu Wali Kelas (Tahap 2), bukan dari role.</p>
    </div>
  )
}
