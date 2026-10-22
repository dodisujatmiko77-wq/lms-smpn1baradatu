import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .max(72, 'Password maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Password harus mengandung huruf.')
  .regex(/[0-9]/, 'Password harus mengandung angka.')

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, 'Ulangi password baru.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi password tidak sama.' })
