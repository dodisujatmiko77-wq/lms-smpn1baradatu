import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { adminUsers } from '@/features/users/api'
import { RELIGIONS, STUDENT_STATUS } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const opt = (s) => z.union([z.literal(''), s])
const schema = z.object({
  full_name: z.string().trim().min(2, 'Nama lengkap wajib diisi.').max(120),
  nisn: z.string().trim().regex(/^\d{10}$/, 'NISN harus 10 digit angka.'),
  nis: z.string().trim().max(20),
  gender: z.enum(['L', 'P'], { message: 'Pilih jenis kelamin.' }),
  birth_place: z.string().trim().max(60),
  birth_date: z.string(),
  religion: z.string(),
  class_id: z.string(),
  status: z.string(),
  parent_name: z.string().trim().max(120),
  parent_phone: opt(z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Nomor HP tidak valid.')),
  entry_year: opt(z.coerce.number().int().min(2000).max(2100)),
  address: z.string().trim().max(300),
})

const EMPTY = { full_name: '', nisn: '', nis: '', gender: '', birth_place: '', birth_date: '', religion: '', class_id: '', status: 'active', parent_name: '', parent_phone: '', entry_year: '', address: '' }

/** mode: 'new' | baris v_students (ubah). classes: kelas tahun pelajaran aktif. */
export function StudentFormModal({ mode, classes, onClose, onSaved, onCreated }) {
  const isEdit = mode && typeof mode === 'object'
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: isEdit ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, mode[k] ?? EMPTY[k]])) : { ...EMPTY, entry_year: String(new Date().getFullYear()) },
  })

  const submit = async (v) => {
    try {
      if (isEdit) {
        const data = { ...v, entry_year: v.entry_year === '' ? '' : String(v.entry_year) }
        delete data.class_id
        delete data.nisn
        unwrap(await supabase.rpc('admin_update_student', { p_student_id: mode.id, p_data: data }))
        if ((mode.class_id ?? '') !== v.class_id) {
          if (v.class_id) unwrap(await supabase.rpc('enroll_students', { p_class_id: v.class_id, p_student_ids: [mode.id] }))
          else unwrap(await supabase.from('class_enrollments').delete().eq('student_id', mode.id).eq('class_id', mode.class_id))
        }
        toast.success('Data siswa diperbarui.')
        onSaved()
      } else {
        const res = await adminUsers({
          action: 'create',
          username: v.nisn,
          full_name: v.full_name,
          roles: ['student'],
          student: {
            nisn: v.nisn,
            nis: v.nis || null,
            gender: v.gender,
            birth_place: v.birth_place || null,
            birth_date: v.birth_date || null,
            religion: v.religion || null,
            address: v.address || null,
            parent_name: v.parent_name || null,
            parent_phone: v.parent_phone || null,
            entry_year: v.entry_year || null,
            class_id: v.class_id || null,
          },
        })
        toast.success(`Akun siswa ${v.full_name} dibuat.`)
        onCreated({ title: 'Akun siswa berhasil dibuat', full_name: v.full_name, username: res.username, password: res.password })
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
      title={isEdit ? `Ubah data ${mode.full_name}` : 'Tambah siswa'}
      description={isEdit ? 'NISN tidak dapat diubah karena dipakai sebagai username login.' : 'NISN dipakai sebagai username login siswa.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="student-form" loading={isSubmitting}>{isEdit ? 'Simpan' : 'Buat akun siswa'}</Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input label="Nama lengkap" required className="sm:col-span-2" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="NISN" required inputMode="numeric" disabled={isEdit} placeholder="10 digit" error={errors.nisn?.message} {...register('nisn')} />
        <Input label="NIS" error={errors.nis?.message} {...register('nis')} />
        <Select label="Jenis kelamin" required error={errors.gender?.message} {...register('gender')}>
          <option value="">—</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </Select>
        <Select label="Kelas (tahun pelajaran aktif)" {...register('class_id')}>
          <option value="">Belum ditempatkan</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Tempat lahir" error={errors.birth_place?.message} {...register('birth_place')} />
        <Input label="Tanggal lahir" type="date" {...register('birth_date')} />
        <Select label="Agama" {...register('religion')}>
          <option value="">—</option>
          {RELIGIONS.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Input label="Tahun masuk" type="number" error={errors.entry_year?.message} {...register('entry_year')} />
        {isEdit && (
          <Select label="Status siswa" {...register('status')}>
            {Object.entries(STUDENT_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </Select>
        )}
        <Input label="Nama orang tua/wali" error={errors.parent_name?.message} {...register('parent_name')} />
        <Input label="No. HP orang tua" inputMode="tel" error={errors.parent_phone?.message} {...register('parent_phone')} />
        <Textarea label="Alamat" className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
      </form>
    </Modal>
  )
}
