import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AtSign, CalendarClock, KeyRound, Mail, Monitor, Moon, Palette, Phone, Save, ShieldCheck, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui'
import { NewPasswordForm } from '@/features/auth/components/NewPasswordForm'
import { ROLE_LABELS } from '@/lib/auth'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'
import { AvatarUploader } from '../components/AvatarUploader'

const phoneSchema = z.object({
  phone: z.union([z.literal(''), z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Nomor HP tidak valid.')]),
})

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="w-32 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-slate-800">{value || '—'}</span>
    </div>
  )
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
  { value: 'system', label: 'Ikuti perangkat', icon: Monitor },
]

function ThemeChooser() {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Tema tampilan" className="grid grid-cols-3 gap-2">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-medium transition',
            theme === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwFormKey, setPwFormKey] = useState(0)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: profile.phone ?? '' } })

  useEffect(() => reset({ phone: profile.phone ?? '' }), [profile.phone, reset])

  const savePhone = async ({ phone }) => {
    const { error } = await supabase.from('profiles').update({ phone: phone || null }).eq('id', profile.id)
    if (error) return toast.error(toMessage(error))
    await refreshProfile()
    toast.success('Nomor HP disimpan.')
  }

  const changePassword = async ({ password }) => {
    setPwError(null)
    if (!currentPassword) return setPwError('Masukkan password saat ini.')
    // Verifikasi password lama sebelum mengganti.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (verifyErr) return setPwError('Password saat ini salah.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setPwError(toMessage(error))
    setCurrentPassword('')
    setPwFormKey((k) => k + 1)
    toast.success('Password berhasil diganti.')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="overflow-hidden lg:col-span-1">
        <div className="h-24 bg-gradient-to-br from-primary-600 to-primary-500" />
        <div className="-mt-10 px-5 pb-5">
          <AvatarUploader />
          <h2 className="mt-2 text-lg font-semibold">{profile.full_name}</h2>
          <p className="text-sm text-slate-500">@{profile.username}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.roles.map((r) => (
              <Badge key={r} tone="blue">
                {ROLE_LABELS[r]}
              </Badge>
            ))}
          </div>
          <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            <InfoRow icon={AtSign} label="Username" value={profile.username} />
            <InfoRow icon={Mail} label="Email kontak" value={profile.contact_email} />
            <InfoRow icon={Phone} label="Nomor HP" value={profile.phone} />
            <InfoRow icon={CalendarClock} label="Login terakhir" value={profile.last_login_at && formatDate(profile.last_login_at, 'd MMM yyyy, HH:mm')} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Foto otomatis dipotong persegi dan diperkecil. Perubahan nama atau email kontak dilakukan oleh administrator.</p>
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader icon={Phone} title="Kontak" description="Nomor HP untuk keperluan komunikasi sekolah" />
          <CardBody>
            <form onSubmit={handleSubmit(savePhone)} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
              <Input label="Nomor HP" inputMode="tel" placeholder="08xxxxxxxxxx" className="flex-1" error={errors.phone?.message} {...register('phone')} />
              <Button type="submit" icon={Save} loading={isSubmitting} disabled={!isDirty} className="sm:mt-[26px]">
                Simpan
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Palette} title="Tampilan" description="Mode gelap lebih nyaman di malam hari dan menghemat baterai HP berlayar OLED" />
          <CardBody>
            <ThemeChooser />
            <p className="mt-2 text-xs text-slate-500">Pilihan ini tersimpan di perangkat ini.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={ShieldCheck} title="Ganti password" description="Gunakan password yang tidak mudah ditebak dan jangan dibagikan" />
          <CardBody>
            <NewPasswordForm key={pwFormKey} onSubmit={changePassword} submitLabel="Ganti password">
              {pwError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pwError}</p>}
              <Input
                label="Password saat ini"
                type="password"
                icon={KeyRound}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </NewPasswordForm>
          </CardBody>
        </Card>

      </div>
    </div>
  )
}
