import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Copy, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, FilterSelect, PageHeader, SkeletonRows } from '@/components/ui'
import { fetchAssignments, keys } from '@/features/master/api'
import { useActiveSemester, useClasses, useInvalidateMaster, useTeacherOptions, useYears } from '@/features/master/hooks'
import { semesterLabel } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AssignmentFormModal } from '../components/AssignmentFormModal'
import { AssignmentsList } from '../components/AssignmentsList'
import { DeleteAssignmentDialog } from '../components/DeleteAssignmentDialog'

export default function TeachingAssignmentsPage() {
  const active = useActiveSemester()
  const years = useYears()
  const [semesterPick, setSemesterPick] = useState(null)
  const semesterId = semesterPick ?? active.semesterId
  const year = years.data?.find((y) => y.semesters.some((s) => s.id === semesterId))
  const semester = year?.semesters.find((s) => s.id === semesterId)
  const [classId, setClassId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const classes = useClasses(year?.id, semesterId)
  const teachers = useTeacherOptions()
  const invalidate = useInvalidateMaster()
  const params = { semesterId, classId: classId || undefined, teacherId: teacherId || undefined }
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: keys.assignments(params), queryFn: () => fetchAssignments(params), enabled: Boolean(semesterId) })
  const [modal, setModal] = useState(null)
  const [remove, setRemove] = useState(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const sourceSemester = semester?.number === 2 ? year.semesters.find((s) => s.number === 1) : null

  const doCopy = async () => {
    setBusy(true)
    try {
      const n = unwrap(await supabase.rpc('copy_teaching_assignments', { p_from_semester: sourceSemester.id, p_to_semester: semesterId }))
      toast.success(n ? `${n} penugasan disalin dari semester Ganjil.` : 'Tidak ada penugasan baru untuk disalin.')
      setCopyOpen(false)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!active.semesterId && !semesterPick) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="Belum ada semester aktif"
          description="Penugasan mengajar dibuat per semester. Aktifkan semester di menu Tahun Pelajaran."
          action={<Link to="/admin/tahun-pelajaran"><Button>Ke Tahun Pelajaran</Button></Link>}
        />
      </Card>
    )
  }

  const rows = data ?? []
  const filtered = classId || teacherId

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penugasan Mengajar"
        description="Setiap penugasan (guru × kelas × mapel) menjadi ruang kelas digital pada semester tersebut."
        actions={
          <>
            {sourceSemester && (
              <Button variant="outline" icon={Copy} onClick={() => setCopyOpen(true)}>Salin dari Ganjil</Button>
            )}
            <Button icon={Plus} onClick={() => setModal('new')}>Tambah penugasan</Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row">
          <FilterSelect value={semesterId ?? ''} onChange={(v) => { setSemesterPick(v); setClassId('') }} label="Semester" className="md:w-64">
            {(years.data ?? []).flatMap((y) =>
              y.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {y.name} · {semesterLabel(s.number)}{s.is_active ? ' (aktif)' : ''}
                </option>
              )),
            )}
          </FilterSelect>
          <FilterSelect value={classId} onChange={setClassId} label="Kelas" className="md:w-44">
            <option value="">Semua kelas</option>
            {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect value={teacherId} onChange={setTeacherId} label="Guru" className="md:w-64">
            <option value="">Semua guru</option>
            {(teachers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </FilterSelect>
          <p className="self-center text-sm text-slate-500 md:ml-auto">{rows.length} penugasan</p>
        </div>
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filtered ? 'Tidak ada penugasan yang cocok' : 'Belum ada penugasan mengajar'}
            description={filtered ? 'Ubah filter kelas atau guru.' : 'Tetapkan guru untuk setiap mapel di setiap kelas. Satu guru bisa ditugaskan ke beberapa kelas sekaligus.'}
            action={!filtered && <Button icon={Plus} onClick={() => setModal('new')}>Tambah penugasan</Button>}
          />
        ) : (
          <AssignmentsList rows={rows} onEdit={setModal} onDelete={setRemove} />
        )}
      </Card>

      <AssignmentFormModal
        key={modal?.id ?? String(modal)}
        mode={modal}
        semesterId={semesterId}
        yearId={year?.id}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null)
          invalidate()
        }}
      />
      <DeleteAssignmentDialog assignment={remove} onClose={() => setRemove(null)} onDeleted={() => { setRemove(null); invalidate() }} />
      <ConfirmDialog
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        onConfirm={doCopy}
        loading={busy}
        tone="primary"
        title="Salin penugasan dari semester Ganjil?"
        confirmLabel="Salin"
        message="Semua penugasan semester Ganjil disalin ke semester ini. Penugasan yang sudah ada tidak akan digandakan. Jadwal tidak ikut disalin."
      />
    </div>
  )
}
