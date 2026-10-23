import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck2, CalendarX2, ChevronDown, ChevronRight, LogOut, Menu, Moon, Repeat, Search, Sun, UserRound, X } from 'lucide-react'
import { useTheme } from '@/app/providers/ThemeProvider'
import { useAuth } from '@/app/providers/AuthProvider'
import { Dropdown, DropdownItem } from '@/components/ui'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useActiveSemester } from '@/features/master/hooks'
import { MyAvatar } from '@/features/profile/components/MyAvatar'
import { ROLE_AREAS, ROLE_LABELS } from '@/lib/auth'
import { MenuSearch } from './MenuSearch'
import { ThemeToggle } from './ThemeToggle'

function ThemeMenuItem() {
  const { resolved, toggle } = useTheme()
  return (
    <DropdownItem icon={resolved === 'dark' ? Sun : Moon} onClick={toggle} className="sm:hidden">
      {resolved === 'dark' ? 'Mode terang' : 'Mode gelap'}
    </DropdownItem>
  )
}

export function Header({ title, crumbs, area, groups, onOpenMenu, onLogout }) {
  const { profile, roles } = useAuth()
  const [mobileSearch, setMobileSearch] = useState(false)
  const otherRoles = roles.filter((r) => r !== area)
  const semester = useActiveSemester()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button onClick={onOpenMenu} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Buka menu">
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">{title}</h1>
          {crumbs?.length > 0 && (
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-slate-500 sm:flex">
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                  {c.to && i < crumbs.length - 1 ? (
                    <Link to={c.to} className="hover:text-primary-600">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={i === crumbs.length - 1 ? 'font-medium text-slate-700' : ''}>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        {semester.label ? (
          <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 xl:flex">
            <CalendarCheck2 className="h-3.5 w-3.5" /> TP {semester.label}
          </span>
        ) : (
          area === 'admin' && (
            <Link to="/admin/tahun-pelajaran" className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100 xl:flex">
              <CalendarX2 className="h-3.5 w-3.5" /> Semester belum aktif
            </Link>
          )
        )}

        <MenuSearch groups={groups} className="hidden w-64 md:block lg:w-80" />

        <button
          onClick={() => setMobileSearch((s) => !s)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Cari"
        >
          {mobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>

        <ThemeToggle className="hidden sm:block" />

        <NotificationBell />

        <Dropdown
          trigger={({ toggle, open }) => (
            <button onClick={toggle} className="flex items-center gap-2 rounded-xl p-1 pr-1.5 hover:bg-slate-100" aria-expanded={open}>
              <span className="sr-only">Menu akun</span>
              <MyAvatar size="sm" />
              <span className="hidden text-left lg:block">
                <span className="block max-w-36 truncate text-sm font-medium leading-tight text-slate-800">{profile?.full_name}</span>
                <span className="block text-xs text-slate-500">{ROLE_LABELS[area]}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
            </button>
          )}
        >
          <div className="mb-1 border-b border-slate-100 px-2.5 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{profile?.full_name}</p>
            <p className="truncate text-xs text-slate-500">@{profile?.username}</p>
          </div>
          <DropdownItem as={Link} to="/profil" icon={UserRound}>
            Profil Saya
          </DropdownItem>
          <ThemeMenuItem />
          {otherRoles.map((r) => (
            <DropdownItem key={r} as={Link} to={ROLE_AREAS[r]} icon={Repeat}>
              Beralih ke {ROLE_LABELS[r]}
            </DropdownItem>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <DropdownItem icon={LogOut} danger onClick={onLogout}>
            Keluar
          </DropdownItem>
        </Dropdown>
      </div>

      {mobileSearch && (
        <div className="border-t border-slate-100 px-4 py-2.5 md:hidden">
          <MenuSearch groups={groups} autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  )
}
