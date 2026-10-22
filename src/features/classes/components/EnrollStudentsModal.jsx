import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, EmptyState, Modal, SearchInput, Skeleton } from '@/components/ui'
import { useInvalidateMaster } from '@/features/master/hooks'
import { useDebounce } from '@/hooks/useDebounce'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

async function fetchCandidates({ yearId, search }) {
  let q = supabase.from('v_students').select('id, full_name, nisn, gender').eq('status', 'active').order('full_name').limit(200)
  const term = search.replace(/[,()*%"\\]/g, ' ').trim()
  if (term) q = q.or(`full_name.ilike."*${term}*",nisn.ilike."*${term}*"`)
  const students = unwrap(await q)
  const enrolled = unwrap(await supabase.from('class_enrollments').select('student_id, class:classes(name)').eq('academic_year_id', yearId))
  const map = new Map(enrolled.map((e) => [e.student_id, e.class.name]))
  return students.map((s) => ({ ...s, current_class: map.get(s.id) ?? null }))
}

/** Menempatkan (atau memindahkan) siswa ke kelas. */
export function EnrollStudentsModal({ open, cls, onClose }) {
  const [search, setSearch] = useState('')
  const [showPlaced, setShowPlaced] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const debounced = useDebounce(search)
  const invalidate = useInvalidateMaster()
  const { data, isLoading } = useQuery({
    queryKey: ['master', 'enroll-candidates', cls?.academic_year_id, debounced],
    queryFn: () => fetchCandidates({ yearId: cls.academic_year_id, search: debounced }),
    enabled: open && Boolean(cls),
  })

  const rows = useMemo(
    () => (data ?? []).filter((s) => s.current_class !== cls?.name && (showPlaced || !s.current_class)),
    [data, showPlaced, cls],
  )

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      const n = unwrap(await supabase.rpc('enroll_students', { p_class_id: cls.id, p_student_ids: [...selected] }))
      toast.success(`${n} siswa ditempatkan di ${cls.name}.`)
      setSelected(new Set())
      invalidate()
      onClose()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Tambah siswa ke ${cls?.name ?? ''}`}
      description="Pilih siswa aktif. Siswa yang sudah punya kelas akan dipindahkan bila dipilih."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button icon={UserPlus} onClick={save} loading={saving} disabled={selected.size === 0}>Tempatkan {selected.size || ''} siswa</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau NISN…" className="flex-1" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showPlaced} onChange={(e) => setShowPlaced(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            Tampilkan yang sudah punya kelas
          </label>
        </div>
        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState icon={UserPlus} title="Tidak ada siswa" description={showPlaced ? 'Tidak ada siswa yang cocok.' : 'Semua siswa aktif sudah memiliki kelas, atau belum ada data siswa.'} className="py-6" />
        ) : (
          <div className="rounded-xl border border-slate-200">
            <label className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                className="h-4 w-4 accent-primary-600"
              />
              Pilih semua ({rows.length})
            </label>
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
              {rows.map((s) => (
                <li key={s.id}>
                  <label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50', selected.has(s.id) && 'bg-primary-50/50')}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-primary-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{s.full_name}</span>
                      <span className="text-xs text-slate-500">NISN {s.nisn} · {s.gender}</span>
                    </span>
                    {s.current_class && <Badge tone="orange">Di {s.current_class}</Badge>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
