import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { toMessage } from '@/lib/errors'
import { AuthAlert, AuthLayout } from '../components/AuthLayout'
import { NewPasswordForm } from '../components/NewPasswordForm'

/** Wajib ganti password setelah akun dibuat atau direset oleh admin. */
export default function ChangePasswordPage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  if (!profile?.must_change_password) return <Navigate to="/" replace />

  const onSubmit = async ({ password }) => {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) return setError(toMessage(err))
    const { error: rpcErr } = await supabase.rpc('mark_password_changed')
    if (rpcErr) return setError(toMessage(rpcErr))
    await refreshProfile()
    toast.success('Password berhasil diganti. Selamat belajar!')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-success-50 text-success-600">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">Ganti password Anda</h1>
      <p className="mb-6 mt-2 text-sm text-slate-500">
        Halo <span className="font-medium text-slate-700">{profile.full_name}</span>, demi keamanan akun, ganti password sementara dari
        administrator dengan password pribadi Anda.
      </p>
      <NewPasswordForm onSubmit={onSubmit} submitLabel="Simpan & lanjutkan">
        {error && <AuthAlert>{error}</AuthAlert>}
      </NewPasswordForm>
      <Button
        variant="ghost"
        className="mt-3 w-full"
        icon={LogOut}
        onClick={async () => {
          await signOut()
          navigate('/login', { replace: true })
        }}
      >
        Keluar
      </Button>
    </AuthLayout>
  )
}
