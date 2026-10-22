import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { fetchAssignments, fetchSchedules, keys } from '@/features/master/api'
import { useInvalidateMaster } from '@/features/master/hooks'
import { dayLabel, hhmm } from '@/lib/academic'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { ScheduleFormModal } from './ScheduleFormModal'
import { WeekSchedule } from './WeekSchedule'

/** Editor jadwal mingguan satu kelas (semester tertentu). */
export function ClassScheduleEditor({ classId, semesterId }) {
  const invalidate = useInvalidateMaster()
  const assignments = useQuery({ queryKey: keys.assignments({ semesterId, classId }), queryFn: () => fetchAssignments({ semesterId, classId }), enabled: Boolean(classId && semesterId) })
  const schedule = useQuery({ queryKey: keys.classSchedule(classId, semesterId), queryFn: () => fetchSchedules({ semesterId, classId }), enabled: Boolean(classId && semesterId) })
  const [modal, setModal] = useState(null)
  const [remove, setRemove] = useState(null)
  const [busy, setBusy] = useState(false)

  if (assignments.isLoading || schedule.isLoading) return <Skeleton className="h-72 rounded-xl" />
  if (assignments.isError || schedule.isError) return <ErrorState error={assignments.error ?? schedule.error} onRetry={() => { assignments.refetch(); schedule.refetch() }} />
  if ((assignments.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        tone="accent"
        title="Belum ada mata pelajaran di kelas ini"
        description="Jadwal disusun dari penugasan mengajar. Tambahkan penugasan (mapel + guru) untuk kelas ini terlebih dahulu."
      />
    )
  }

  const doRemove = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('schedules').delete().eq('id', remove.id))
      toast.success('Jadwal dihapus.')
      setRemove(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <WeekSchedule items={schedule.data ?? []} subtitle={(s) => s.teacher_name} onAdd={(day) => setModal({ day })} onEdit={setModal} onDelete={setRemove} />
      <ScheduleFormModal
        key={modal?.id ?? modal?.day ?? 'none'}
        mode={modal}
        assignments={assignments.data}
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
        title="Hapus jadwal?"
        confirmLabel="Hapus"
        message={remove && `${remove.subject_name} hari ${dayLabel(remove.day_of_week)} pukul ${hhmm(remove.start_time)}–${hhmm(remove.end_time)} akan dihapus.`}
      />
    </>
  )
}
