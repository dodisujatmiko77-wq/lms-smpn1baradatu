import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { LogOut } from 'lucide-react'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { Button, ErrorState } from '@/components/ui'

/** Melindungi rute: wajib login, akun aktif, dan sudah mengganti password awal. */
export function RequireAuth() {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (profileError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <div className="space-y-3 text-center">
          <ErrorState error={profileError} onRetry={refreshProfile} title="Gagal memuat akun" />
          <Button variant="ghost" icon={LogOut} onClick={signOut}>
            Keluar
          </Button>
        </div>
      </div>
    )
  }
  if (!profile) return <FullPageLoader label="Memuat profil…" />
  if (profile.must_change_password && location.pathname !== '/ganti-password') {
    return <Navigate to="/ganti-password" replace />
  }
  return <Outlet />
}
