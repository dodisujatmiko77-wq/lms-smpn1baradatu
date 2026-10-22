import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, FileUp, School, Save } from 'lucide-react'
import { toast } from 'sonner'
import { SCHOOL_SETTINGS_KEY, fetchSchoolSettings } from '@/app/providers/SettingsProvider'
import { Button, Card, CardBody, CardHeader, ErrorState, Input, Skeleton, Textarea } from '@/components/ui'
import { Switch } from '@/components/ui/Input'
import { LogoUploader } from '../components/LogoUploader'
import { supabase } from '@/lib/supabase'
import { toMessage } from '@/lib/errors'

const optional = (schema) => z.union([z.literal(''), schema])

const schema = z.object({
  school_name: z.string().trim().min(3, 'Nama sekolah wajib diisi.').max(150),
  short_name: z.string().trim().min(2, 'Nama singkat wajib diisi.').max(60),
  app_name: z.string().trim().min(2, 'Nama aplikasi wajib diisi.').max(60),
  tagline: z.string().trim().max(160),
  npsn: optional(z.string().trim().regex(/^[0-9]{8}$/, 'NPSN terdiri dari 8 digit.')),
  address: z.string().trim().max(300),
  phone: optional(z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, 'Nomor telepon tidak valid.')),
  email: optional(z.string().trim().email('Format email tidak valid.')),
  website: optional(z.string().trim().url('Gunakan format https://…')),
  max_upload_mb: z.coerce.number().int().min(1, 'Minimal 1 MB.').max(50, 'Maksimal 50 MB.'),
  max_image_upload_mb: z.coerce.number().int().min(1, 'Minimal 1 MB.').max(20, 'Maksimal 20 MB.'),
  allowed_file_types: z
    .string()
    .trim()
    .min(1, 'Isi minimal satu jenis file.')
    .regex(/^[a-z0-9]+(\s*,\s*[a-z0-9]+)*$/i, 'Pisahkan ekstensi dengan koma, contoh: pdf, docx, jpg'),
  notification_prefs: z.record(z.string(), z.boolean()),
  material_requires_publish: z.boolean(),
})

const NOTIF_OPTIONS = [
  ['new_material', 'Materi baru diunggah', 'Siswa diberi tahu saat guru mempublikasikan materi.'],
  ['new_assignment', 'Tugas baru', 'Siswa diberi tahu saat tugas baru diterbitkan.'],
  ['deadline_reminder', 'Pengingat tenggat', 'Pengingat H-1 sebelum tenggat tugas.'],
  ['grade_published', 'Nilai diterbitkan', 'Siswa diberi tahu saat nilai dipublikasikan.'],
  ['announcement', 'Pengumuman', 'Pengguna diberi tahu saat ada pengumuman baru.'],
]

const toForm = (s) => ({
  school_name: s.school_name ?? '',
  short_name: s.short_name ?? '',
  app_name: s.app_name ?? '',
  tagline: s.tagline ?? '',
  npsn: s.npsn ?? '',
  address: s.address ?? '',
  phone: s.phone ?? '',
  email: s.email ?? '',
  website: s.website ?? '',
  max_upload_mb: s.max_upload_mb,
  max_image_upload_mb: s.max_image_upload_mb,
  allowed_file_types: (s.allowed_file_types ?? []).join(', '),
  notification_prefs: s.notification_prefs ?? {},
  material_requires_publish: s.material_requires_publish,
})

export default function SchoolSettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: SCHOOL_SETTINGS_KEY, queryFn: fetchSchoolSettings })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data) reset(toForm(data))
  }, [data, reset])

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      npsn: values.npsn || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      allowed_file_types: [...new Set(values.allowed_file_types.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))],
    }
    const { data: saved, error: err } = await supabase.from('school_settings').update(payload).eq('id', true).select().single()
    if (err) return toast.error(toMessage(err))
    qc.setQueryData(SCHOOL_SETTINGS_KEY, saved)
    reset(toForm(saved))
    toast.success('Pengaturan sekolah disimpan.')
  }

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  if (isError)
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pengaturan Sekolah</h2>
          <p className="mt-1 text-sm text-slate-500">Konfigurasi terpusat yang dipakai di seluruh aplikasi. Setiap perubahan tercatat di audit log.</p>
        </div>
        <Button type="submit" icon={Save} loading={isSubmitting} disabled={!isDirty}>
          Simpan perubahan
        </Button>
      </div>

      <Card>
        <CardHeader icon={School} title="Identitas sekolah & aplikasi" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Input label="Nama sekolah" required error={errors.school_name?.message} {...register('school_name')} />
          <Input label="Nama singkat" required error={errors.short_name?.message} {...register('short_name')} />
          <Input label="Nama aplikasi" required error={errors.app_name?.message} {...register('app_name')} />
          <Input label="NPSN" inputMode="numeric" error={errors.npsn?.message} {...register('npsn')} />
          <Input label="Tagline" className="md:col-span-2" error={errors.tagline?.message} {...register('tagline')} />
          <Textarea label="Alamat" className="md:col-span-2" error={errors.address?.message} {...register('address')} />
          <Input label="Telepon" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
          <Input label="Email sekolah" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Website" placeholder="https://" className="md:col-span-2" error={errors.website?.message} {...register('website')} />
          <div className="md:col-span-2">
            <LogoUploader />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={FileUp} title="Unggahan file" description="Menjaga kuota penyimpanan Supabase tetap hemat" />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Maks. dokumen (MB)" type="number" min={1} max={50} error={errors.max_upload_mb?.message} {...register('max_upload_mb')} />
              <Input label="Maks. gambar (MB)" type="number" min={1} max={20} error={errors.max_image_upload_mb?.message} {...register('max_image_upload_mb')} />
            </div>
            <Input label="Jenis file yang diizinkan" hint="Pisahkan dengan koma. Video sebaiknya melalui tautan YouTube." error={errors.allowed_file_types?.message} {...register('allowed_file_types')} />
            <Controller
              name="material_requires_publish"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  onChange={field.onChange}
                  label="Materi wajib dipublikasikan"
                  description="Materi baru tersimpan sebagai draf dan baru terlihat siswa setelah guru menekan Publikasikan."
                />
              )}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Bell} title="Notifikasi" description="Jenis notifikasi yang dikirim ke pengguna (aktif pada Tahap 6)" />
          <CardBody className="space-y-4">
            {NOTIF_OPTIONS.map(([key, label, desc]) => (
              <Controller
                key={key}
                name={`notification_prefs.${key}`}
                control={control}
                render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label={label} description={desc} />}
              />
            ))}
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
