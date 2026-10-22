import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Library, MoreVertical, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, ConfirmDialog, DataTable, Dropdown, DropdownItem, EmptyState, ErrorState, Input, Modal, PageHeader, Select, SkeletonRows } from '@/components/ui'
import { useInvalidateMaster, useSubjects } from '@/features/master/hooks'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { DEFAULT_SUBJECTS, SUBJECT_COLORS, SUBJECT_GROUPS } from '../defaults'

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/, '2–12 karakter: huruf kapital, angka, atau strip.'),
  name: z.string().trim().min(3, 'Nama mapel wajib diisi.').max(100),
  group_name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sort_order: z.coerce.number().int().min(0).max(99),
})

function SubjectFormModal({ subject, open, onClose, onSaved, nextOrder }) {
  const isEdit = Boolean(subject)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: subject ?? { code: '', name: '', group_name: 'Umum', color: SUBJECT_COLORS[0], sort_order: nextOrder },
  })
  // eslint-disable-next-line react-hooks/incompatible-library
  const color = watch('color')

  const submit = async (v) => {
    try {
      if (isEdit) unwrap(await supabase.from('subjects').update(v).eq('id', subject.id))
      else unwrap(await supabase.from('subjects').insert(v))
      toast.success(isEdit ? 'Mata pelajaran diperbarui.' : 'Mata pelajaran ditambahkan.')
      onSaved()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Ubah mata pelajaran' : 'Tambah mata pelajaran'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="subject-form" loading={isSubmitting}>Simpan</Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Input label="Kode" required placeholder="MTK" error={errors.code?.message} {...register('code')} />
          <Input label="Nama mata pelajaran" required placeholder="Matematika" error={errors.name?.message} {...register('name')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Kelompok" {...register('group_name')}>
            {SUBJECT_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </Select>
          <Input label="Urutan tampil" type="number" min={0} max={99} error={errors.sort_order?.message} {...register('sort_order')} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">Warna penanda</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c, { shouldDirty: true })}
                className={cn('h-8 w-8 rounded-full ring-offset-2 transition', color === c ? 'ring-2 ring-slate-900' : 'hover:scale-110')}
                style={{ backgroundColor: c }}
                aria-label={`Warna ${c}`}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function SubjectsPage() {
  const { data, isLoading, isError, error, refetch } = useSubjects()
  const invalidate = useInvalidateMaster()
  const [modal, setModal] = useState(null)
  const [remove, setRemove] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = data ?? []

  const addDefaults = async () => {
    setBusy(true)
    try {
      const res = unwrap(await supabase.from('subjects').upsert(DEFAULT_SUBJECTS, { onConflict: 'code', ignoreDuplicates: true }).select('id'))
      toast.success(res.length ? `${res.length} mata pelajaran standar ditambahkan.` : 'Semua mapel standar sudah ada.')
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (s) => {
    try {
      unwrap(await supabase.from('subjects').update({ is_active: !s.is_active }).eq('id', s.id))
      toast.success(s.is_active ? `${s.name} disembunyikan dari pilihan.` : `${s.name} diaktifkan kembali.`)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  const doRemove = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('subjects').delete().eq('id', remove.id))
      toast.success('Mata pelajaran dihapus.')
      setRemove(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Mata pelajaran',
      render: (s) => (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: s.color }}>
            {s.code.slice(0, 3)}
          </span>
          <div className="min-w-0">
            <p className={cn('truncate font-medium', s.is_active ? 'text-slate-900' : 'text-slate-400 line-through')}>{s.name}</p>
            <p className="text-xs text-slate-500">{s.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'group_name', header: 'Kelompok', render: (s) => <Badge tone={s.group_name === 'Umum' ? 'blue' : s.group_name === 'Pilihan' ? 'violet' : 'orange'}>{s.group_name}</Badge> },
    { key: 'sort_order', header: 'Urutan' },
    { key: 'is_active', header: 'Status', render: (s) => (s.is_active ? <Badge tone="green" dot>Aktif</Badge> : <Badge dot>Disembunyikan</Badge>) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mata Pelajaran"
        description="Daftar mapel yang dapat ditugaskan ke guru dan kelas."
        actions={
          <>
            <Button variant="outline" icon={Sparkles} loading={busy && !remove} onClick={addDefaults}>Tambahkan mapel standar</Button>
            <Button icon={Plus} onClick={() => setModal('new')}>Tambah mapel</Button>
          </>
        }
      />
      <Card>
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Library}
            title="Belum ada mata pelajaran"
            description="Tambahkan 12 mapel standar SMP Kurikulum Merdeka sekaligus, lalu sesuaikan bila perlu."
            action={<Button icon={Sparkles} onClick={addDefaults} loading={busy}>Tambahkan mapel standar</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            actions={(s) => (
              <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi"><MoreVertical className="h-4 w-4" /></Button>}>
                <DropdownItem icon={Pencil} onClick={() => setModal(s)}>Ubah</DropdownItem>
                <DropdownItem icon={s.is_active ? EyeOff : Eye} onClick={() => toggleActive(s)}>{s.is_active ? 'Sembunyikan' : 'Aktifkan'}</DropdownItem>
                <DropdownItem icon={Trash2} danger onClick={() => setRemove(s)}>Hapus</DropdownItem>
              </Dropdown>
            )}
          />
        )}
      </Card>

      <SubjectFormModal
        key={modal?.id ?? String(modal)}
        open={Boolean(modal)}
        subject={modal === 'new' ? null : modal}
        nextOrder={rows.length + 1}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null)
          invalidate()
        }}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        onConfirm={doRemove}
        loading={busy}
        title="Hapus mata pelajaran?"
        confirmLabel="Hapus"
        message={remove && `${remove.name} akan dihapus permanen. Bila mapel sudah dipakai di penugasan mengajar, gunakan "Sembunyikan".`}
      />
    </div>
  )
}
