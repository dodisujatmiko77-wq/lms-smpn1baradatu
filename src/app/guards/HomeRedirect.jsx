import { Navigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { ROLE_AREAS } from '@/lib/auth'
import { ForbiddenPage } from '@/features/system/pages/ForbiddenPage'

/** "/" → dashboard sesuai role pengguna. */
export function HomeRedirect() {
  const { defaultRole } = useAuth()
  if (!defaultRole) {
    return <ForbiddenPage title="Akun belum memiliki role" message="Akun Anda belum diberi role oleh administrator. Silakan hubungi administrator sekolah." />
  }
  return <Navigate to={ROLE_AREAS[defaultRole]} replace />
}
