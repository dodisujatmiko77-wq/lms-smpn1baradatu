import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { ForbiddenPage } from '@/features/system/pages/ForbiddenPage'

/** Mencegah akses lintas role di sisi tampilan. RLS tetap menjadi pengaman utama. */
export function RequireRole({ role }) {
  const { roles, setLastRole } = useAuth()
  const allowed = roles.includes(role)

  useEffect(() => {
    if (allowed) setLastRole(role)
  }, [allowed, role, setLastRole])

  return allowed ? <Outlet /> : <ForbiddenPage />
}
