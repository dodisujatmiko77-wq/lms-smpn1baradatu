import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Phone, UserRound } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { RoleCheckboxes } from './RoleCheckboxes'

const schema = z.object({
  full_name: z.string().trim().min(2, 'Nama lengkap wajib diisi.').max(120),
  contact_email: z.union([z.literal(''), z.string().trim().email('Format email tidak valid.')]),
  phone: z.union([z.literal(''), z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Nomor HP tidak valid.')]),
  roles: z.array(z.enum(['admin', 'teacher', 'student'])).min(1, 'Pilih minimal satu role.'),
})

export function EditUserModal({ user, onClose, onSubmit }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (user)
      reset({
        full_name: user.full_name,
        contact_email: user.contact_email ?? '',
        phone: user.phone ?? '',
        roles: user.user_roles.map((r) => r.role),
      })
  }, [user, reset])

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title="Ubah data akun"
      description={user ? `@${user.username}` : undefined}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="edit-user-form" loading={isSubmitting}>
            Simpan perubahan
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Nama lengkap" required icon={UserRound} error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Email kontak" type="email" icon={Mail} error={errors.contact_email?.message} {...register('contact_email')} />
        <Input label="Nomor HP" icon={Phone} inputMode="tel" error={errors.phone?.message} {...register('phone')} />
        <Controller name="roles" control={control} render={({ field }) => <RoleCheckboxes value={field.value ?? []} onChange={field.onChange} error={errors.roles?.message} />} />
      </form>
    </Modal>
  )
}
