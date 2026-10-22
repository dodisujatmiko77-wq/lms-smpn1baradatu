import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarRange, Layers, MoreVertical, Pencil, Plus, School, ShieldCheck, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ConfirmDialog, Dropdown, DropdownItem, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { useActiveSemester, useClasses, useInvalidateMaster, useYears } from '@/features/master/hooks'
import { GRADES } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ClassFormModal } from '../components/ClassFormModal'
import { YearSelect } from '../components/YearSelect'

function ClassCard({ cls, onEdit, onDelete }) {
  const navigate = useNavigate()
  const pct = Math.min(100, Math.round((cls.student_count / cls.capacity) * 100))
  return (
    <Card className="group cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-card-hover" onClick={() => navigate(`/admin/kelas/${cls.id}`)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display text-lg font-semibold">{cls.name}</h4>
          <p className="text-xs text-slate-500">{cls.room || 'Ruang belum diatur'}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={`Aksi ${cls.name}`}><MoreVertical className="h-4 w-4" /></Button>}>
            <DropdownItem icon={Pencil} onClick={() => onEdit(cls)}>Ubah</DropdownItem>
            <DropdownItem icon={Trash2} danger onClick={() => onDelete(cls)}>Hapus</DropdownItem>
          </Dropdown>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600"><Users className="h-3.5 w-3.5" /> {cls.student_count} / {cls.capacity} siswa</span>
          <span className="text-slate-500">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full', pct > 100 ? 'bg-red-500' : pct >= 90 ? 'bg-accent-500' : 'bg-primary-500')} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className={cn('mt-3 flex items-center gap-1.5 truncate text-xs', cls.guardian ? 'text-slate-600' : 'text-accent-600')}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        {cls.guardian ? cls.guardian.full_name : 'Wali kelas belum ditetapkan'}
      </p>
    </Card>
  )
}

export default function ClassesPage() {
  const active = useActiveSemester()
  const years = useYears()
  const [yearId, setYearId] = useState(null)
  const selectedYear = yearId ?? active.yearId ?? years.data?.[0]?.id ?? null
  const yearObj = years.data?.find((y) => y.id === selectedYear)
  const semesterId = yearObj?.semesters.find((s) => s.is_active)?.id ?? yearObj?.semesters[0]?.id
  const classes = useClasses(selectedYear, semesterId)
  const invalidate = useInvalidateMaster()
  const [modal, setModal] = useState(null)
  const [remove, setRemove] = useState(null)
  const [busy, setBusy] = useState(false)

  const doRemove = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('classes').delete().eq('id', remove.id))
      toast.success(`Kelas ${remove.name} dihapus.`)
      setRemove(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!years.isLoading && (years.data ?? []).length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarRange}
          title="Buat tahun pelajaran terlebih dahulu"
          description="Kelas selalu terikat pada tahun pelajaran."
          action={<Link to="/admin/tahun-pelajaran"><Button>Ke Tahun Pelajaran</Button></Link>}
        />
      </Card>
    )
  }

  const rows = classes.data ?? []
  const total = rows.reduce((n, c) => n + c.student_count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelas"
        description={`${rows.length} kelas · ${total} siswa ditempatkan. Klik kelas untuk mengelola siswa, mapel, dan jadwalnya.`}
        actions={
          <>
            <YearSelect years={years.data} value={selectedYear} onChange={setYearId} className="w-52" />
            <Button variant="outline" icon={Layers} onClick={() => setModal('bulk')} disabled={!selectedYear}>Buat sekaligus</Button>
            <Button icon={Plus} onClick={() => setModal('new')} disabled={!selectedYear}>Tambah kelas</Button>
          </>
        }
      />

      {classes.isLoading || years.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : classes.isError ? (
        <Card><ErrorState error={classes.error} onRetry={classes.refetch} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={School}
            title="Belum ada kelas"
            description={`Tambahkan rombel untuk TP ${yearObj?.name ?? ''}. Gunakan "Buat sekaligus" untuk membuat VII-A s.d. VII-F dalam satu langkah.`}
            action={<Button icon={Layers} onClick={() => setModal('bulk')}>Buat sekaligus</Button>}
          />
        </Card>
      ) : (
        GRADES.map((g) => {
          const list = rows.filter((c) => c.grade === g.value)
          if (list.length === 0) return null
          return (
            <section key={g.value}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {g.label}
                <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-600">{list.length}</span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((c) => <ClassCard key={c.id} cls={c} onEdit={setModal} onDelete={setRemove} />)}
              </div>
            </section>
          )
        })
      )}

      <ClassFormModal
        key={modal?.id ?? String(modal)}
        mode={modal}
        yearId={selectedYear}
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
        title="Hapus kelas?"
        confirmLabel="Hapus"
        message={remove && `Kelas ${remove.name} akan dihapus. Penghapusan ditolak bila masih ada siswa atau penugasan mengajar di kelas ini.`}
      />
    </div>
  )
}
