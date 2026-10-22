import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, LogOut, X } from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { CURRENT_STAGE } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { SchoolLogo } from './SchoolLogo'

/**
 * Sidebar menu berdasarkan role.
 * - variant "rail": desktop/tablet (md: ikon saja, lg: penuh kecuali diciutkan)
 * - variant "drawer": HP (selalu penuh, dibuka dari tombol menu)
 */
export function Sidebar({ groups, variant = 'rail', collapsed = false, onToggleCollapse, onClose, onLogout }) {
  const { app_name, short_name } = useSchoolSettings()
  const isDrawer = variant === 'drawer'
  // Kelas untuk elemen yang hanya tampil saat sidebar lebar.
  const wide = isDrawer ? '' : collapsed ? 'hidden' : 'hidden lg:block'
  const wideFlex = isDrawer ? 'flex' : collapsed ? 'hidden' : 'hidden lg:flex'

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-slate-200/80 bg-white',
        isDrawer ? 'w-72' : cn('w-[76px] transition-[width] duration-200', !collapsed && 'lg:w-64'),
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-4">
        <SchoolLogo className="h-10 w-10 shrink-0 shadow-sm shadow-primary-600/30" />
        <div className={cn('min-w-0 flex-1', wide)}>
          <p className="truncate font-display text-[15px] font-semibold leading-tight text-slate-900">{app_name}</p>
          <p className="truncate text-xs text-slate-500">{short_name}</p>
        </div>
        {isDrawer && (
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Menu utama">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && (
              <p className={cn('mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400', wide)}>
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    title={item.label}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors',
                        !isDrawer && (collapsed ? 'justify-center' : 'justify-center lg:justify-start'),
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary-600" />}
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600')} />
                        <span className={cn('flex-1 truncate', wide)}>{item.label}</span>
                        {item.stage > CURRENT_STAGE && (
                          <span className={cn('rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400', wide)}>
                            T{item.stage}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-100 p-3">
        {!isDrawer && (
          <button
            onClick={onToggleCollapse}
            className="hidden w-full items-center justify-center gap-3 rounded-[10px] px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 lg:flex"
            aria-label={collapsed ? 'Perlebar sidebar' : 'Ciutkan sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            <span className={cn('flex-1 text-left', wide)}>Ciutkan</span>
          </button>
        )}
        <button
          onClick={onLogout}
          title="Keluar"
          className={cn(
            'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50',
            !isDrawer && (collapsed ? 'justify-center' : 'justify-center lg:justify-start'),
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className={wideFlex}>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
