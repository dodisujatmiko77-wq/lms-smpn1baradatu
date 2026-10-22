import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export function DeleteAssignmentDialog({ assignment, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('teaching_assignments').delete().eq('id', assignment.id))
      toast.success('Penugasan dihapus.')
      onDeleted()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog
      open={Boolean(assignment)}
      onClose={onClose}
      onConfirm={run}
      loading={busy}
      title="Hapus penugasan?"
      confirmLabel="Hapus"
      message={
        assignment &&
        `${assignment.subject.name} di ${assignment.class.name} (${assignment.teacher.profile.full_name}) akan dihapus${assignment.schedule_count ? ` beserta ${assignment.schedule_count} jadwalnya` : ''}.`
      }
    />
  )
}
