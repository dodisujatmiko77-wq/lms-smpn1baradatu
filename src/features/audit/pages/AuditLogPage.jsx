import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, History } from 'lucide-react'
import { Badge, Card, EmptyState, ErrorState, Pagination, SkeletonRows } from '@/components/ui'
import { inputClass } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'
import { actionLabel, actionTone } from '../actionLabels'

const PAGE_SIZE = 25
const FILTERS = [
  { value: 'all', label: 'Semua aktivitas' },
  { value: 'user.', label: 'Manajemen akun' },
  { value: 'user_roles.', label: 'Perubahan role' },
  { value: 'school_settings.', label: 'Pengaturan sekolah' },
  { value: 'teaching_assignments.', label: 'Penugasan mengajar' },
  { value: 'class_guardians.', label: 'Wali kelas' },
  { value: 'class_enrollments.', label: 'Penempatan siswa' },
  { value: 'students.', label: 'Data siswa' },
  { value: 'teachers.', label: 'Data guru' },
  { value: 'classes.', label: 'Kelas' },
  { value: 'semesters.', label: 'Semester' },
]

async function fetchAudit({ page, filter }) {
  let q = supabase
    .from('audit_logs')
    .select('id, action, entity, entity_id, details, created_at, actor:profiles(full_name, username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (filter !== 'all') q = q.like('action', `${filter}%`)
  const { data, error, count } = await q
  if (error) throw error
  return { rows: data, total: count ?? 0 }
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', page, filter],
    queryFn: () => fetchAudit({ page, filter }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-slate-500">Catatan tindakan penting. Data ini hanya dapat dibaca dan tidak dapat diubah atau dihapus.</p>
        </div>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          className={cn(inputClass(false), 'h-10 pr-8 sm:w-56')}
          aria-label="Filter aktivitas"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.rows.length === 0 ? (
          <EmptyState icon={History} title="Belum ada catatan" description="Tindakan seperti membuat akun atau mengubah pengaturan akan tercatat di sini." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    className="flex w-full flex-col gap-2 px-5 py-3.5 text-left hover:bg-slate-50/60 sm:flex-row sm:items-center sm:gap-4"
                    aria-expanded={expanded === row.id}
                  >
                    <span className="w-40 shrink-0 text-xs text-slate-500">{formatDate(row.created_at, 'd MMM yyyy, HH:mm')}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-slate-900">{row.actor?.full_name ?? 'Sistem'}</span>
                      {row.actor?.username && <span className="text-slate-500"> @{row.actor.username}</span>}
                    </span>
                    <Badge tone={actionTone(row.action)}>{actionLabel(row.action)}</Badge>
                    <ChevronDown className={cn('hidden h-4 w-4 text-slate-400 transition sm:block', expanded === row.id && 'rotate-180')} />
                  </button>
                  {expanded === row.id && (
                    <pre className="mx-5 mb-4 max-h-72 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 scrollbar-thin">
                      {JSON.stringify({ entitas: row.entity, id: row.entity_id, detail: row.details }, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
