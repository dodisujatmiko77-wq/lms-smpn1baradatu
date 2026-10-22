import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarCheck2, CalendarRange, MoreVertical, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton } from '@/components/ui'
import { useInvalidateMaster, useYears } from '@/features/master/hooks'
import { semesterLabel, suggestAcademicYear } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'

const yearSchema = z
  .object({
    name: z.string().trim().regex(/^\d{4}\/\d{4}$/, 'Format: 2026/2027'),
    start_date: z.string().min(1, 'Wajib diisi.'),
    end_date: z.string().min(1, 'Wajib diisi.'),
  })
  .refine((v) => Number(v.name.slice(5)) === Number(v.name.slice(0, 4)) + 1, { path: ['name'], message: 'Tahun kedua harus tahun pertama + 1.' })
  .refine((v) => v.end_date > v.start_date, { path: ['end_date'], message: 'Harus setelah tanggal mulai.' })

const rangeSchema = z
  .object({ start_date: z.string().min(1, 'Wajib diisi.'), end_date: z.string().min(1, 'Wajib diisi.') })
  .refine((v) => v.end_date > v.start_date, { path: ['end_date'], message: 'Harus setelah tanggal mulai.' })

function YearFormModal({ open, year, onClose, onSaved }) {
  const isEdit = Boolean(year)
  const defaults = year ?? suggestAcademicYear()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(yearSchema),
    values: { name: defaults.name, start_date: defaults.start_date ?? defaults.start, end_date: defaults.end_date ?? defaults.end },
  })

  const submit = async (v) => {
    try {
      if (isEdit) unwrap(await supabase.from('academic_years').update(v).eq('id', year.id))
      else unwrap(await supabase.rpc('admin_create_academic_year', { p_name: v.name, p_start_date: v.start_date, p_end_date: v.end_date }))
      toast.success(isEdit ? 'Tahun pelajaran diperbarui.' : `Tahun pelajaran ${v.name} dibuat beserta semester Ganjil & Genap.`)
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Ubah tahun pelajaran' : 'Tambah tahun pelajaran'}
      description={isEdit ? undefined : 'Semester Ganjil dan Genap dibuat otomatis; tanggalnya bisa diubah kemudian.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="year-form" loading={isSubmitting}>Simpan</Button>
        </>
      }
    >
      <form id="year-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Input label="Tahun pelajaran" required placeholder="2026/2027" error={errors.name?.message} {...register('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Tanggal mulai" type="date" required error={errors.start_date?.message} {...register('start_date')} />
          <Input label="Tanggal selesai" type="date" required error={errors.end_date?.message} {...register('end_date')} />
        </div>
      </form>
    </Modal>
  )
}

function SemesterDatesModal({ semester, onClose, onSaved }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(rangeSchema), values: semester ? { start_date: semester.start_date, end_date: semester.end_date } : undefined })

  const submit = async (v) => {
    try {
      unwrap(await supabase.from('semesters').update(v).eq('id', semester.id))
      toast.success('Tanggal semester diperbarui.')
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={Boolean(semester)}
      onClose={onClose}
      title={`Ubah tanggal semester ${semesterLabel(semester?.number)}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="sem-form" loading={isSubmitting}>Simpan</Button>
        </>
      }
    >
      <form id="sem-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Input label="Tanggal mulai" type="date" error={errors.start_date?.message} {...register('start_date')} />
        <Input label="Tanggal selesai" type="date" error={errors.end_date?.message} {...register('end_date')} />
      </form>
    </Modal>
  )
}

export default function AcademicYearsPage() {
  const { data: years, isLoading, isError, error, refetch } = useYears()
  const invalidate = useInvalidateMaster()
  const { refreshProfile } = useAuth()
  const [yearModal, setYearModal] = useState(null) // null | 'new' | year
  const [editSemester, setEditSemester] = useState(null)
  const [activate, setActivate] = useState(null)
  const [remove, setRemove] = useState(null)
  const [busy, setBusy] = useState(false)

  const saved = () => {
    setYearModal(null)
    setEditSemester(null)
    invalidate()
  }

  const doActivate = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.rpc('set_active_semester', { p_semester_id: activate.semester.id }))
      await refreshProfile()
      invalidate()
      toast.success(`Semester aktif: ${activate.year.name} ${semesterLabel(activate.semester.number)}.`)
      setActivate(null)
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doRemove = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('academic_years').delete().eq('id', remove.id))
      toast.success(`Tahun pelajaran ${remove.name} dihapus.`)
      setRemove(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tahun Pelajaran & Semester"
        description="Seluruh data akademik (kelas, penugasan, jadwal) terikat pada tahun pelajaran dan semester. Hanya satu semester yang aktif."
        actions={<Button icon={Plus} onClick={() => setYearModal('new')}>Tambah tahun pelajaran</Button>}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : years.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="Belum ada tahun pelajaran"
            description="Mulailah dengan membuat tahun pelajaran berjalan, lalu aktifkan semesternya."
            action={<Button icon={Plus} onClick={() => setYearModal('new')}>Tambah tahun pelajaran</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {years.map((y) => (
            <Card key={y.id} className={cn('overflow-hidden', y.is_active && 'ring-2 ring-primary-500/40')}>
              <div className={cn('flex items-start justify-between gap-3 px-5 py-4', y.is_active ? 'bg-gradient-to-br from-primary-600 to-primary-500 text-white' : 'border-b border-slate-100')}>
                <div>
                  <p className={cn('text-xs font-medium', y.is_active ? 'text-primary-100' : 'text-slate-500')}>Tahun Pelajaran</p>
                  <h3 className={cn('font-display text-2xl font-semibold', y.is_active && 'text-white')}>{y.name}</h3>
                  <p className={cn('mt-0.5 text-xs', y.is_active ? 'text-primary-100' : 'text-slate-500')}>
                    {formatDate(y.start_date)} – {formatDate(y.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {y.is_active && <Badge className="bg-white/20 text-white">Aktif</Badge>}
                  <Dropdown
                    trigger={({ toggle }) => (
                      <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi" className={y.is_active ? 'text-white hover:bg-white/15 hover:text-white' : ''}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  >
                    <DropdownItem icon={Pencil} onClick={() => setYearModal(y)}>Ubah</DropdownItem>
                    {!y.is_active && <DropdownItem icon={Trash2} danger onClick={() => setRemove(y)}>Hapus</DropdownItem>}
                  </Dropdown>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {y.semesters.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className={cn('grid h-10 w-10 place-items-center rounded-xl', s.is_active ? 'bg-success-50 text-success-600' : 'bg-slate-100 text-slate-500')}>
                      <CalendarCheck2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        Semester {semesterLabel(s.number)}
                        {s.is_active && <Badge tone="green" dot>Aktif</Badge>}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(s.start_date)} – {formatDate(s.end_date)}</p>
                    </div>
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditSemester(s)}>Tanggal</Button>
                    {!s.is_active && (
                      <Button variant="secondary" size="sm" icon={Zap} onClick={() => setActivate({ year: y, semester: s })}>Aktifkan</Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <YearFormModal key={yearModal?.id ?? String(yearModal)} open={Boolean(yearModal)} year={yearModal === 'new' ? null : yearModal} onClose={() => setYearModal(null)} onSaved={saved} />
      <SemesterDatesModal semester={editSemester} onClose={() => setEditSemester(null)} onSaved={saved} />
      <ConfirmDialog
        open={Boolean(activate)}
        onClose={() => setActivate(null)}
        onConfirm={doActivate}
        loading={busy}
        tone="primary"
        title="Aktifkan semester?"
        confirmLabel="Aktifkan"
        message={activate && `Semester ${semesterLabel(activate.semester.number)} ${activate.year.name} akan menjadi semester aktif untuk seluruh pengguna. Jadwal, penugasan, dan dashboard akan mengikuti semester ini.`}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        onConfirm={doRemove}
        loading={busy}
        title="Hapus tahun pelajaran?"
        confirmLabel="Hapus"
        message={remove && `Tahun pelajaran ${remove.name} beserta semesternya akan dihapus. Penghapusan ditolak bila sudah ada kelas atau penugasan di dalamnya.`}
      />
    </div>
  )
}
