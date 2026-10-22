import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AtSign, KeyRound, Mail, UserRound } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { USERNAME_PATTERN } from '@/lib/auth'
import { RoleCheckboxes } from './RoleCheckboxes'

const schema = z.object({
  full_name: z.string().trim().min(2, 'Nama lengkap wajib diisi.').max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, 'Gunakan 3–40 karakter: huruf kecil, angka, titik, garis bawah, atau strip.'),
  roles: z.array(z.enum(['admin', 'teacher', 'student'])).min(1, 'Pilih minimal satu role.'),
  contact_email: z.union([z.literal(''), z.string().trim().email('Format email tidak valid.')]),
  password: z.union([
    z.literal(''),
    z.string().min(8, 'Minimal 8 karakter.').regex(/[A-Za-z]/, 'Harus mengandung huruf.').regex(/[0-9]/, 'Harus mengandung angka.'),
  ]),
})

export function CreateUserModal({ open, onClose, onSubmit }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', username: '', roles: ['student'], contact_email: '', password: '' },
  })

  const close = () => {
    reset()
    onClose()
  }

  const submit = async (values) => {
    const ok = await onSubmit(values)
    if (ok) reset()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Tambah akun pengguna"
      description="Akun dibuat aman melalui server. Password sementara akan ditampilkan sekali."
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="create-user-form" loading={isSubmitting}>
            Buat akun
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Input label="Nama lengkap" required icon={UserRound} placeholder="Nama sesuai data sekolah" error={errors.full_name?.message} {...register('full_name')} />
        <Input
          label="Username"
          required
          icon={AtSign}
          placeholder="NISN untuk siswa, NIP untuk guru"
          hint="Dipakai untuk login. Tidak dapat diubah dari sini setelah akun dibuat."
          autoCapitalize="none"
          error={errors.username?.message}
          {...register('username')}
        />
        <Controller name="roles" control={control} render={({ field }) => <RoleCheckboxes value={field.value} onChange={field.onChange} error={errors.roles?.message} />} />
        <Input label="Email kontak (opsional)" type="email" icon={Mail} placeholder="nama@email.com" error={errors.contact_email?.message} {...register('contact_email')} />
        <Input
          label="Password awal (opsional)"
          type="password"
          icon={KeyRound}
          autoComplete="new-password"
          hint="Kosongkan agar sistem membuat password acak yang mudah dibaca."
          error={errors.password?.message}
          {...register('password')}
        />
      </form>
    </Modal>
  )
}
