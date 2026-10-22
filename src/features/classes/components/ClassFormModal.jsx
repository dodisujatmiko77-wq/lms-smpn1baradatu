import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, Input, Modal, Select } from '@/components/ui'
import { GRADES, gradeRoman } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const singleSchema = z.object({
  grade: z.coerce.number().int().min(7).max(9),
  name: z.string().trim().min(1, 'Nama kelas wajib diisi.').max(30),
  room: z.string().trim().max(50),
  capacity: z.coerce.number().int().min(1, 'Minimal 1.').max(60, 'Maksimal 60.'),
})

const bulkSchema = z.object({
  grade: z.coerce.number().int().min(7).max(9),
  count: z.coerce.number().int().min(1, 'Minimal 1.').max(15, 'Maksimal 15.'),
  capacity: z.coerce.number().int().min(1).max(60),
})

const LETTERS = 'ABCDEFGHIJKLMNO'

/** mode: 'new' | 'bulk' | objek kelas (ubah) */
export function ClassFormModal({ mode, yearId, onClose, onSaved }) {
  const isBulk = mode === 'bulk'
  const isEdit = mode && typeof mode === 'object'
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isBulk ? bulkSchema : singleSchema),
    values: isEdit
      ? { grade: mode.grade, name: mode.name, room: mode.room ?? '', capacity: mode.capacity }
      : isBulk
        ? { grade: 7, count: 6, capacity: 32 }
        : { grade: 7, name: 'VII-', room: '', capacity: 32 },
  })
  // eslint-disable-next-line react-hooks/incompatible-library
  const [grade, count] = watch(['grade', 'count'])
  const preview = isBulk ? Array.from({ length: Math.min(Number(count) || 0, 15) }, (_, i) => `${gradeRoman(Number(grade))}-${LETTERS[i]}`) : []

  const submit = async (v) => {
    try {
      if (isBulk) {
        const rows = preview.map((name) => ({ academic_year_id: yearId, grade: v.grade, name, capacity: v.capacity }))
        const res = unwrap(await supabase.from('classes').upsert(rows, { onConflict: 'academic_year_id,name', ignoreDuplicates: true }).select('id'))
        toast.success(`${res.length} kelas dibuat${res.length < rows.length ? ` (${rows.length - res.length} sudah ada)` : ''}.`)
      } else {
        const row = { grade: v.grade, name: v.name.toUpperCase(), room: v.room || null, capacity: v.capacity }
        if (isEdit) unwrap(await supabase.from('classes').update(row).eq('id', mode.id))
        else unwrap(await supabase.from('classes').insert({ ...row, academic_year_id: yearId }))
        toast.success(isEdit ? 'Kelas diperbarui.' : `Kelas ${row.name} dibuat.`)
      }
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      title={isEdit ? `Ubah kelas ${mode.name}` : isBulk ? 'Buat beberapa kelas sekaligus' : 'Tambah kelas'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="class-form" loading={isSubmitting}>{isBulk ? `Buat ${preview.length} kelas` : 'Simpan'}</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Select label="Tingkat" {...register('grade')}>
          {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </Select>
        {isBulk ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Jumlah rombel" type="number" min={1} max={15} error={errors.count?.message} {...register('count')} />
              <Input label="Kapasitas per kelas" type="number" min={1} max={60} error={errors.capacity?.message} {...register('capacity')} />
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Kelas yang akan dibuat (yang sudah ada dilewati):</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.map((n) => <span key={n} className="rounded-lg bg-white px-2.5 py-1 text-sm font-medium text-slate-700 shadow-sm">{n}</span>)}
              </div>
            </div>
          </>
        ) : (
          <>
            <Input label="Nama kelas" required placeholder="VII-A" hint="Contoh: VII-A, VIII-B, IX-C" error={errors.name?.message} {...register('name')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Ruang" placeholder="Ruang 7A" error={errors.room?.message} {...register('room')} />
              <Input label="Kapasitas" type="number" min={1} max={60} error={errors.capacity?.message} {...register('capacity')} />
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}
