import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button, EmptyState } from '@/components/ui'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { supabase } from '@/lib/supabase'
import { toMessage } from '@/lib/errors'
import { AuthAlert, AuthLayout } from '../components/AuthLayout'
import { NewPasswordForm } from '../components/NewPasswordForm'

/** Halaman tujuan tautan reset password dari email. */
export default function ResetPasswordPage() {
  const { session, loading, setRecoveryMode, refreshProfile } = useAuth()
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  if (loading) return <FullPageLoader />

  const onSubmit = async ({ password }) => {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) return setError(toMessage(err))
    await supabase.rpc('mark_password_changed')
    await refreshProfile()
    setRecoveryMode(false)
    toast.success('Password berhasil diperbarui.')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout>
      {!session ? (
        <EmptyState
          icon={LinkIcon}
          tone="accent"
          title="Tautan tidak valid atau kedaluwarsa"
          description="Minta tautan reset baru, atau hubungi administrator sekolah."
          action={
            <Link to="/lupa-password">
              <Button variant="outline">Minta tautan baru</Button>
            </Link>
          }
        />
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Atur password baru</h1>
          <p className="mb-6 mt-2 text-sm text-slate-500">Buat password baru untuk akun Anda.</p>
          <NewPasswordForm onSubmit={onSubmit}>{error && <AuthAlert>{error}</AuthAlert>}</NewPasswordForm>
        </>
      )}
    </AuthLayout>
  )
}
