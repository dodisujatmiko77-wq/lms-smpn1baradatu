import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, CalendarClock, DoorOpen, Plus, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Skeleton, SkeletonRows, Tabs } from '@/components/ui'
import { AssignmentFormModal } from '@/features/assignments/components/AssignmentFormModal'
import { AssignmentsList } from '@/features/assignments/components/AssignmentsList'
import { DeleteAssignmentDialog } from '@/features/assignments/components/DeleteAssignmentDialog'
import { GuardianSelect } from '@/features/guardians/components/GuardianSelect'
import { fetchAssignments, keys } from '@/features/master/api'
import { useInvalidateMaster } from '@/features/master/hooks'
import { ClassScheduleEditor } from '@/features/schedules/components/ClassScheduleEditor'
import { STUDENT_STATUS, semesterLabel } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { EnrollStudentsModal } from '../components/EnrollStudentsModal'

async function fetchClassDetail(id) {
  return unwrap(
    await supabase
      .from('classes')
      .select('*, year:academic_years(id, name, is_active, semesters(id, number, is_active)), class_guardians(semester_id, teacher_id)')
      .eq('id', id)
      .single(),
  )
}

async function fetchMembers(classId) {
  const rows = unwrap(
    await supabase
      .from('class_enrollments')
      .select('id, student:students(id, nisn, nis, gender, status, profile:profiles(full_name, username, is_active))')
      .eq('class_id', classId),
  )
  return rows.sort((a, b) => a.student.profile.full_name.localeCompare(b.student.profile.full_name))
}

function MembersTab({ cls }) {
  const invalidate = useInvalidateMaster()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: [...keys.class(cls.id), 'members'], queryFn: () => fetchMembers(cls.id) })
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [remove, setRemove] = useState(null)
  const [busy, setBusy] = useState(false)

  const doRemove = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('class_enrollments').delete().eq('id', remove.id))
      toast.success(`${remove.student.profile.full_name} dikeluarkan dari ${cls.name}.`)
      setRemove(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const rows = data ?? []
  const male = rows.filter((r) => r.student.gender === 'L').length

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{rows.length}</span> siswa · {male} L · {rows.length - male} P
        </p>
        <Button size="sm" icon={UserPlus} onClick={() => setEnrollOpen(true)}>Tambah siswa</Button>
      </div>
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada siswa di kelas ini" description="Tambahkan siswa yang sudah terdaftar di Data Siswa." action={<Button icon={UserPlus} onClick={() => setEnrollOpen(true)}>Tambah siswa</Button>} />
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'no', header: 'No', className: 'w-12 text-slate-400', hideOnMobile: true, render: (r) => rows.indexOf(r) + 1 },
            {
              key: 'name',
              header: 'Nama',
              render: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.student.profile.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{r.student.profile.full_name}</p>
                    <p className="text-xs text-slate-500">NISN {r.student.nisn}</p>
                  </div>
                </div>
              ),
            },
            { key: 'nis', header: 'NIS', render: (r) => r.student.nis ?? '—' },
            { key: 'gender', header: 'L/P', render: (r) => r.student.gender },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={STUDENT_STATUS[r.student.status].tone}>{STUDENT_STATUS[r.student.status].label}</Badge> },
          ]}
          actions={(r) => (
            <Button variant="ghost" size="icon-sm" onClick={() => setRemove(r)} aria-label={`Keluarkan ${r.student.profile.full_name}`}>
              <UserMinus className="h-4 w-4 text-slate-500" />
            </Button>
          )}
        />
      )}
      <EnrollStudentsModal open={enrollOpen} cls={cls} onClose={() => setEnrollOpen(false)} />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        onConfirm={doRemove}
        loading={busy}
        title="Keluarkan dari kelas?"
        confirmLabel="Keluarkan"
        message={remove && `${remove.student.profile.full_name} akan dikeluarkan dari ${cls.name}. Data siswa dan akunnya tetap ada.`}
      />
    </Card>
  )
}

function SubjectsTab({ cls, semesterId }) {
  const invalidate = useInvalidateMaster()
  const params = { semesterId, classId: cls.id }
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: keys.assignments(params), queryFn: () => fetchAssignments(params), enabled: Boolean(semesterId) })
  const [modal, setModal] = useState(null)
  const [remove, setRemove] = useState(null)
  const rows = data ?? []
  const hours = rows.reduce((n, r) => n + (r.hours_per_week ?? 0), 0)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{rows.length}</span> mapel · {hours} jam/minggu
        </p>
        <Button size="sm" icon={Plus} onClick={() => setModal('new')}>Tambah mapel</Button>
      </div>
      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="Belum ada mapel & guru" description="Tetapkan guru untuk setiap mata pelajaran di kelas ini." action={<Button icon={Plus} onClick={() => setModal('new')}>Tambah mapel</Button>} />
      ) : (
        <AssignmentsList rows={rows} hideClass onEdit={setModal} onDelete={setRemove} />
      )}
      <AssignmentFormModal
        key={modal?.id ?? String(modal)}
        mode={modal}
        semesterId={semesterId}
        yearId={cls.academic_year_id}
        fixedClassId={cls.id}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null)
          invalidate()
        }}
      />
      <DeleteAssignmentDialog
        assignment={remove}
        onClose={() => setRemove(null)}
        onDeleted={() => {
          setRemove(null)
          invalidate()
        }}
      />
    </Card>
  )
}

export default function ClassDetailPage() {
  const { id } = useParams()
  const { data: cls, isLoading, isError, error, refetch } = useQuery({ queryKey: keys.class(id), queryFn: () => fetchClassDetail(id) })
  const [tab, setTab] = useState('students')
  const [semesterId, setSemesterId] = useState(null)

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <Card><ErrorState error={error} onRetry={refetch} /></Card>

  const semesters = [...cls.year.semesters].sort((a, b) => a.number - b.number)
  const semId = semesterId ?? semesters.find((s) => s.is_active)?.id ?? semesters[0]?.id
  const guardianId = cls.class_guardians.find((g) => g.semester_id === semId)?.teacher_id

  return (
    <div className="space-y-6">
      <Link to="/admin/kelas" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Semua kelas
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 bg-gradient-to-br from-primary-700 to-primary-500 p-6 text-white lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-primary-100">TP {cls.year.name}{cls.year.is_active ? ' · aktif' : ''}</p>
            <h2 className="font-display text-3xl font-semibold text-white">Kelas {cls.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-100">
              <DoorOpen className="h-4 w-4" /> {cls.room || 'Ruang belum diatur'} · kapasitas {cls.capacity}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex gap-1 rounded-xl bg-white/15 p-1">
              {semesters.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSemesterId(s.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${s.id === semId ? 'bg-white text-primary-700' : 'text-white/90 hover:bg-white/10'}`}
                >
                  {semesterLabel(s.number)}{s.is_active ? ' •' : ''}
                </button>
              ))}
            </div>
            <div className="min-w-60 space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary-100"><ShieldCheck className="h-3.5 w-3.5" /> Wali kelas</p>
              {semId && <GuardianSelect classId={cls.id} classLabel={cls.name} className="bg-white" semesterId={semId} value={guardianId} onSaved={refetch} />}
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'students', label: 'Siswa', icon: Users },
          { value: 'subjects', label: 'Mapel & Guru', icon: BookOpen },
          { value: 'schedule', label: 'Jadwal', icon: CalendarClock },
        ]}
      />

      {tab === 'students' && <MembersTab cls={cls} />}
      {tab === 'subjects' && <SubjectsTab cls={cls} semesterId={semId} />}
      {tab === 'schedule' && <ClassScheduleEditor classId={cls.id} semesterId={semId} />}
    </div>
  )
}
