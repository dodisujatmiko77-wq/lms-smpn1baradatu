import { Suspense, useState } from 'react'
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { ConfirmDialog, Skeleton } from '@/components/ui'
import { STUDENT_BOTTOM_NAV, navigationFor } from '@/config/navigation'
import { ROLE_AREAS, ROLE_LABELS, roleFromPath } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Header } from './Header'
import { MobileBottomNav } from './MobileBottomNav'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'lms.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export function DashboardLayout() {
  const { defaultRole, isGuardian, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const matches = useMatches()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const area = roleFromPath(location.pathname) ?? defaultRole
  const groups = navigationFor(area, { isGuardian })

  const handle = [...matches].reverse().find((m) => m.handle?.title)?.handle ?? {}
  const crumbs = [{ label: ROLE_LABELS[area], to: ROLE_AREAS[area] }, ...(handle.crumbs ?? []), ...(handle.title && !handle.isHome ? [{ label: handle.title }] : [])]

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* abaikan */
      }
      return !c
    })
  }

  const doLogout = async () => {
    setLoggingOut(true)
    await signOut()
    setLoggingOut(false)
    setConfirmLogout(false)
    toast.success('Anda telah keluar. Sampai jumpa!')
    navigate('/login', { replace: true })
  }

  const isStudent = area === 'student'

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar desktop & tablet */}
      <div className="sticky top-0 hidden h-dvh shrink-0 md:block">
        <Sidebar groups={groups} collapsed={collapsed} onToggleCollapse={toggleCollapse} onLogout={() => setConfirmLogout(true)} />
      </div>

      {/* Drawer HP */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-slide-in-left shadow-pop">
            <Sidebar
              groups={groups}
              variant="drawer"
              onClose={() => setDrawerOpen(false)}
              onLogout={() => {
                setDrawerOpen(false)
                setConfirmLogout(true)
              }}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={handle.title ?? 'Dashboard'}
          crumbs={crumbs}
          area={area}
          groups={groups}
          onOpenMenu={() => setDrawerOpen(true)}
          onLogout={() => setConfirmLogout(true)}
        />
        <main className={cn('flex-1 px-4 py-6 sm:px-6 lg:px-8', isStudent && 'pb-24 md:pb-6')}>
          <div key={location.pathname} className="mx-auto w-full max-w-7xl animate-fade-in">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {isStudent && <MobileBottomNav items={STUDENT_BOTTOM_NAV} />}

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={doLogout}
        loading={loggingOut}
        title="Keluar dari LMS?"
        message="Anda perlu login kembali untuk mengakses ruang belajar."
        confirmLabel="Keluar"
      />
    </div>
  )
}
