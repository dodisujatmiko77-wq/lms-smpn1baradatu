import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { adminUsers } from '@/features/users/api'
import { EMPLOYMENT_STATUS } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const opt = (s) => z.union([z.literal(''), s])
const schema = z
  .object({
    full_name: z.string().trim().min(2, 'Nama lengkap wajib diisi.').max(120),
    gender: z.enum(['', 'L', 'P']),
    nip: opt(z.string().trim().regex(/^\d{18}$/, 'NIP harus 18 digit angka.')),
    nuptk: opt(z.string().trim().regex(/^\d{16}$/, 'NUPTK harus 16 digit angka.')),
    username: opt(z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, '3–40 karakter: huruf kecil, angka, titik, garis bawah, strip.')),
    employment_status: z.string(),
    phone: opt(z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Nomor HP tidak valid.')),
    contact_email: opt(z.string().trim().email('Format email tidak valid.')),
    birth_place: z.string().trim().max(60),
    birth_date: z.string(),
  })

const EMPTY = { full_name: '', gender: '', nip: '', nuptk: '', username: '', employment_status: '', phone: '', contact_email: '', birth_place: '', birth_date: '' }

/** mode: 'new' | baris v_teachers (ubah) */
export function TeacherFormModal({ mode, onClose, onSaved, onCreated }) {
  const isEdit = mode && typeof mode === 'object'
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: isEdit ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, mode[k] ?? ''])) : EMPTY,
  })

  const submit = async (v) => {
    const detail = {
      nip: v.nip || null,
      nuptk: v.nuptk || null,
      gender: v.gender || null,
      birth_place: v.birth_place || null,
      birth_date: v.birth_date || null,
      employment_status: v.employment_status || null,
    }
    try {
      if (isEdit) {
        unwrap(await supabase.rpc('admin_update_teacher', { p_teacher_id: mode.id, p_data: { ...detail, full_name: v.full_name, phone: v.phone, contact_email: v.contact_email } }))
        toast.success('Data guru diperbarui.')
        onSaved()
      } else {
        const username = (v.nip || v.nuptk || v.username || '').toLowerCase()
        if (!username) return setError('username', { message: 'Isi NIP, NUPTK, atau username.' })
        const res = await adminUsers({
          action: 'create',
          username,
          full_name: v.full_name,
          roles: ['teacher'],
          phone: v.phone || null,
          contact_email: v.contact_email || null,
          teacher: detail,
        })
        toast.success(`Akun guru ${v.full_name} dibuat.`)
        onCreated({ title: 'Akun guru berhasil dibuat', full_name: v.full_name, username: res.username, password: res.password })
      }
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Ubah data ${mode.full_name}` : 'Tambah guru'}
      description={isEdit ? `Username: ${mode.username}` : 'Username login otomatis memakai NIP, lalu NUPTK; bila keduanya kosong isi username sendiri.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="teacher-form" loading={isSubmitting}>{isEdit ? 'Simpan' : 'Buat akun guru'}</Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input label="Nama lengkap & gelar" required className="sm:col-span-2" placeholder="Siti Aminah, S.Pd." error={errors.full_name?.message} {...register('full_name')} />
        <Input label="NIP" inputMode="numeric" placeholder="18 digit" error={errors.nip?.message} {...register('nip')} />
        <Input label="NUPTK" inputMode="numeric" placeholder="16 digit" error={errors.nuptk?.message} {...register('nuptk')} />
        {!isEdit && <Input label="Username (bila tanpa NIP/NUPTK)" placeholder="contoh: siti.aminah" error={errors.username?.message} {...register('username')} />}
        <Select label="Jenis kelamin" {...register('gender')}>
          <option value="">—</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </Select>
        <Select label="Status kepegawaian" {...register('employment_status')}>
          <option value="">—</option>
          {EMPLOYMENT_STATUS.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Input label="No. HP" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
        <Input label="Email kontak" type="email" error={errors.contact_email?.message} {...register('contact_email')} />
        <Input label="Tempat lahir" error={errors.birth_place?.message} {...register('birth_place')} />
        <Input label="Tanggal lahir" type="date" {...register('birth_date')} />
      </form>
    </Modal>
  )
}
