import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ClipboardList } from 'lucide-react'
import { Badge, Card, EmptyState, ErrorState, FilterSelect, SearchInput, SkeletonRows } from '@/components/ui'
import { DueLabel } from '@/features/tasks/status'
import { cn } from '@/lib/utils'
import { fetchAssignmentMonitor, fetchMissingStudents, rkeys } from '../api'
import { ExportButtons } from './ExportButtons'
import { PercentBar, fmt } from './ScoreCell'

function MissingList({ id }) {
  const q = useQuery({ queryKey: rkeys.missing(id), queryFn: () => fetchMissingStudents(id) })
  if (q.isLoading) return <SkeletonRows rows={2} />
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />
  if (!q.data.length) return <p className="px-5 py-3 text-sm text-success-700">Semua siswa sudah mengumpulkan atau dinilai.</p>
  return (
    <ul className="flex flex-wrap gap-2 px-5 py-3">
      {q.data.map((s) => (
        <li key={s.student_id}><Badge tone={s.submission_status === 'draft' ? 'blue' : 'red'}>{s.full_name}{s.submission_status === 'draft' ? ' (draf)' : ''}</Badge></li>
      ))}
    </ul>
  )
}

const FILTERS = {
  all: () => true,
  overdue: (r) => new Date(r.due_at) < new Date() && r.missing > 0,
  active: (r) => new Date(r.due_at) >= new Date(),
  ungraded: (r) => r.submitted > r.graded,
}

/** Monitoring tugas & pengumpulan (admin: semua kelas; wali kelas: kelas binaan). */
export function AssignmentMonitor({ classId = null, classes, onClassChange, title = 'Monitoring tugas' }) {
  const q = useQuery({ queryKey: rkeys.assignments(classId), queryFn: () => fetchAssignmentMonitor(classId) })
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const rows = (q.data ?? []).filter(FILTERS[filter]).filter((r) => `${r.title} ${r.subject_name} ${r.teacher_name} ${r.class_name}`.toLowerCase().includes(search.trim().toLowerCase()))
  const build = () => ({
    fileName: title,
    title,
    subtitle: `${filter === 'overdue' ? 'Lewat tenggat & ada yang belum mengumpulkan. ' : ''}${rows.length} tugas`,
    columns: [
      { header: 'Kelas', key: 'class_name', width: 9 },
      { header: 'Mapel', key: 'subject_name', width: 18 },
      { header: 'Guru', key: 'teacher_name', width: 22 },
      { header: 'Tugas', key: 'title', width: 30 },
      { header: 'Tenggat', key: 'due', width: 16 },
      { header: 'Siswa', key: 'student_count', width: 7 },
      { header: 'Terkumpul', key: 'submitted', width: 9 },
      { header: '% kumpul', key: 'pct', width: 8 },
      { header: 'Terlambat', key: 'late', width: 9 },
      { header: 'Belum kumpul', key: 'missing', width: 10 },
      { header: 'Dinilai', key: 'graded', width: 8 },
      { header: 'Rata-rata', key: 'avg_pct', width: 9 },
    ],
    rows: rows.map((r) => ({ ...r, due: new Date(r.due_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }), pct: r.student_count ? Math.round((r.submitted / r.student_count) * 100) : 0, avg_pct: r.avg_pct == null ? null : Number(r.avg_pct) })),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {classes && (
          <div className="sm:w-44">
            <FilterSelect value={classId ?? ''} onChange={(v) => onClassChange(v || null)} label="Kelas">
              {onClassChange && classes.length > 1 && <option value="">Semua kelas</option>}
              {classes.map((c) => <option key={c.id} value={c.id}>Kelas {c.name}</option>)}
            </FilterSelect>
          </div>
        )}
        <div className="sm:w-60">
          <FilterSelect value={filter} onChange={setFilter} label="Status">
            <option value="all">Semua tugas</option>
            <option value="overdue">Lewat tenggat, ada yang belum kumpul</option>
            <option value="active">Masih berjalan</option>
            <option value="ungraded">Ada yang belum dinilai</option>
          </FilterSelect>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari tugas, mapel, guru…" className="sm:w-64" />
        <div className="sm:ml-auto"><ExportButtons build={build} disabled={!rows.length} /></div>
      </div>
      <Card>
        {q.isLoading ? (
          <SkeletonRows rows={5} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Tidak ada tugas" description="Tugas yang diterbitkan guru pada semester aktif akan muncul di sini." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const pct = r.student_count ? (r.submitted / r.student_count) * 100 : 0
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full flex-col gap-2 px-5 py-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
                    <span className="hidden h-10 w-1.5 shrink-0 rounded-full sm:block" style={{ backgroundColor: r.subject_color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{r.title}</span>
                      <span className="block text-xs text-slate-500">Kelas {r.class_name} · {r.subject_name} · {r.teacher_name}</span>
                      <DueLabel dueAt={r.due_at} done={new Date(r.due_at) < new Date() && r.missing === 0} />
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <PercentBar value={pct} />
                      <span className="text-xs text-slate-500">{r.submitted}/{r.student_count} kumpul</span>
                      {r.late > 0 && <Badge tone="orange">{r.late} terlambat</Badge>}
                      {r.missing > 0 && <Badge tone="red">{r.missing} belum kumpul</Badge>}
                      {r.submitted > r.graded && <Badge tone="violet">{r.submitted - r.graded} belum dinilai</Badge>}
                      {r.avg_pct != null && <span className="text-xs text-slate-500">rata-rata {fmt(r.avg_pct)}</span>}
                      <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', open === r.id && 'rotate-180')} />
                    </span>
                  </button>
                  {open === r.id && (
                    <div className="border-t border-dashed border-slate-100 bg-slate-50/50">
                      <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Belum mengumpulkan</p>
                      <MissingList id={r.id} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
