import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, LogIn, UserRound } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button, Input } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { AuthAlert, AuthLayout } from '../components/AuthLayout'

const schema = z.object({
  loginId: z
    .string()
    .trim()
    .min(3, 'Masukkan NISN, NIP, atau username.')
    .max(120)
    .regex(/^[A-Za-z0-9._@+-]+$/, 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.'),
  password: z.string().min(1, 'Password wajib diisi.'),
})

export default function LoginPage() {
  const { session, profile, signIn, authNotice } = useAuth()
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from && location.state.from !== '/login' ? location.state.from : '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { loginId: '', password: '' } })

  if (session && profile) return <Navigate to={from} replace />

  const onSubmit = async ({ loginId, password }) => {
    setError(null)
    try {
      await signIn(loginId, password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold sm:text-3xl">Selamat datang 👋</h1>
      <p className="mt-2 text-sm text-slate-500">Masuk menggunakan akun yang diberikan oleh sekolah.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {(error || authNotice) && <AuthAlert>{error || authNotice}</AuthAlert>}

        <Input
          label="NISN / NIP / Username"
          icon={UserRound}
          placeholder="Contoh: 0123456789"
          autoComplete="username"
          autoCapitalize="none"
          inputMode="text"
          error={errors.loginId?.message}
          {...register('loginId')}
        />
        <Input
          label="Password"
          type="password"
          icon={KeyRound}
          placeholder="Masukkan password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link to="/lupa-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Lupa password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={LogIn}>
          Masuk
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-500">
        Akun dibuat oleh administrator sekolah. Belum punya akun? Hubungi operator atau wali kelas Anda.
      </p>
    </AuthLayout>
  )
}
