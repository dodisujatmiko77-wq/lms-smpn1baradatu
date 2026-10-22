import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, KeyRound } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { newPasswordSchema } from '@/lib/validation'
import { cn } from '@/lib/utils'

const RULES = [
  { test: (v) => v.length >= 8, label: 'Minimal 8 karakter' },
  { test: (v) => /[A-Za-z]/.test(v), label: 'Mengandung huruf' },
  { test: (v) => /[0-9]/.test(v), label: 'Mengandung angka' },
]

/** Form password baru + konfirmasi dengan indikator syarat password. */
export function NewPasswordForm({ onSubmit, submitLabel = 'Simpan password', children }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' } })
  const pw = useWatch({ control, name: 'password' }) ?? ''

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {children}
      <Input label="Password baru" type="password" icon={KeyRound} autoComplete="new-password" error={errors.password?.message} {...register('password')} />
      <ul className="grid gap-1.5 sm:grid-cols-3">
        {RULES.map((r) => {
          const ok = r.test(pw)
          return (
            <li key={r.label} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-success-600' : 'text-slate-500')}>
              <span className={cn('grid h-4 w-4 place-items-center rounded-full', ok ? 'bg-success-100' : 'bg-slate-100')}>
                <Check className="h-3 w-3" />
              </span>
              {r.label}
            </li>
          )
        })}
      </ul>
      <Input label="Ulangi password baru" type="password" icon={KeyRound} autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
