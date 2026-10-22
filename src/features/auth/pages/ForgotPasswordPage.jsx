import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Mail, Send, ShieldQuestion } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { isInternalEmail } from '@/lib/auth'
import { toMessage } from '@/lib/errors'
import { AuthAlert, AuthLayout } from '../components/AuthLayout'

const schema = z.object({ email: z.string().trim().email('Format email tidak valid.') })

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setError(null)
    if (isInternalEmail(email)) {
      setError('Akun ini tidak memakai email pribadi. Minta reset password kepada administrator sekolah.')
      return
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) return setError(toMessage(err))
    setSent(true)
  }

  return (
    <AuthLayout>
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Kembali ke login
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Lupa password?</h1>

      <div className="mt-5 flex gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800">
        <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
        <div>
          <p className="font-medium">Siswa dan guru yang login dengan NISN/NIP</p>
          <p className="mt-1 text-accent-700">
            Hubungi administrator sekolah atau wali kelas untuk mereset password. Anda akan menerima password sementara dan
            diminta menggantinya saat login.
          </p>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-600">Jika akun Anda terdaftar dengan email pribadi, masukkan email tersebut untuk menerima tautan reset.</p>

      {sent ? (
        <div className="mt-5">
          <AuthAlert tone="success">Jika email terdaftar, tautan reset password telah dikirim. Periksa kotak masuk dan folder spam.</AuthAlert>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
          {error && <AuthAlert>{error}</AuthAlert>}
          <Input label="Email" type="email" icon={Mail} placeholder="nama@email.com" error={errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" size="lg" icon={Send} loading={isSubmitting}>
            Kirim tautan reset
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
