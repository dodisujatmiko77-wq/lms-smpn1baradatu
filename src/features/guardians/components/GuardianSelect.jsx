import { useState } from 'react'
import { toast } from 'sonner'
import { FilterSelect } from '@/components/ui'
import { useInvalidateMaster, useTeacherOptions } from '@/features/master/hooks'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/** Pilihan wali kelas untuk satu kelas pada satu semester; tersimpan langsung saat dipilih. */
export function GuardianSelect({ classId, classLabel: cls, semesterId, value, onSaved, className }) {
  const teachers = useTeacherOptions()
  const invalidate = useInvalidateMaster()
  const [saving, setSaving] = useState(false)

  const change = async (teacherId) => {
    setSaving(true)
    try {
      if (teacherId) {
        unwrap(
          await supabase
            .from('class_guardians')
            .upsert({ class_id: classId, semester_id: semesterId, teacher_id: teacherId }, { onConflict: 'class_id,semester_id' }),
        )
        toast.success(`Wali kelas ${cls ?? ''} disimpan.`)
      } else {
        unwrap(await supabase.from('class_guardians').delete().eq('class_id', classId).eq('semester_id', semesterId))
        toast.success(`Wali kelas ${cls ?? ''} dikosongkan.`)
      }
      invalidate()
      onSaved?.()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FilterSelect value={value ?? ''} onChange={change} label={`Wali kelas ${cls ?? ''}`} className={cn(saving && 'opacity-60', className)}>
      <option value="">— Belum ditetapkan —</option>
      {(teachers.data ?? []).filter((t) => t.is_active || t.id === value).map((t) => (
        <option key={t.id} value={t.id}>{t.full_name}</option>
      ))}
    </FilterSelect>
  )
}
