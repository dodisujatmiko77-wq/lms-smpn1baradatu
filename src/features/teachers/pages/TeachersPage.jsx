import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, GraduationCap, KeyRound, MoreVertical, Pencil, Plus, Power, PowerOff, ShieldCheck } from 'lucide-react'
import { Avatar, Badge, Button, Card, DataTable, Dropdown, DropdownItem, EmptyState, ErrorState, FilterSelect, PageHeader, Pagination, SearchInput, SkeletonRows } from '@/components/ui'
import { ImportModal } from '@/features/import/ImportModal'
import { MASTER, keys } from '@/features/master/api'
import { useInvalidateMaster } from '@/features/master/hooks'
import { useAccountActions } from '@/features/users/components/useAccountActions'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/lib/supabase'
import { TeacherFormModal } from '../components/TeacherFormModal'

const PAGE_SIZE = 25

async function fetchTeachers({ page, search, status }) {
  let q = supabase.from('v_teachers').select('*', { count: 'exact' }).order('full_name').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const term = search.replace(/[,()*%"\\]/g, ' ').trim()
  if (term) q = q.or(`full_name.ilike."*${term}*",nip.ilike."*${term}*",username.ilike."*${term}*"`)
  if (status !== 'all') q = q.eq('is_active', status === 'active')
  const { data, count, error } = await q
  if (error) throw error
  return { rows: data, total: count ?? 0 }
}

export default function TeachersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const debounced = useDebounce(search)
  const params = { page, search: debounced, status }
  const qc = useQueryClient()
  const invalidate = useInvalidateMaster()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...keys.teachers, params],
    queryFn: () => fetchTeachers(params),
    placeholderData: keepPreviousData,
  })
  const [modal, setModal] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const account = useAccountActions({ onChanged: invalidate })
  const refreshAll = () => {
    invalidate()
    qc.invalidateQueries({ queryKey: ['admin'] })
  }

  const rows = data?.rows ?? []
  const filtered = debounced || status !== 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Guru"
        description="Setiap guru memiliki akun login. Penugasan mengajar & wali kelas diatur di menu Akademik."
        actions={
          <>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Impor Excel</Button>
            <Button icon={Plus} onClick={() => setModal('new')}>Tambah guru</Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Cari nama, NIP, atau username…" className="sm:w-80" />
          <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1) }} label="Status akun" className="sm:w-44">
            <option value="all">Semua status</option>
            <option value="active">Akun aktif</option>
            <option value="inactive">Akun nonaktif</option>
          </FilterSelect>
        </div>
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={filtered ? 'Tidak ada guru yang cocok' : 'Belum ada data guru'}
            description={filtered ? 'Ubah kata kunci atau filter.' : 'Tambahkan guru satu per satu atau impor sekaligus dari Excel.'}
            action={!filtered && <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Impor Excel</Button>}
          />
        ) : (
          <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <DataTable
              rows={rows}
              columns={[
                {
                  key: 'name',
                  header: 'Guru',
                  render: (t) => (
                    <div className="flex items-center gap-3">
                      <Avatar name={t.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{t.full_name}</p>
                        <p className="truncate text-xs text-slate-500">@{t.username}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'nip', header: 'NIP / NUPTK', render: (t) => <span className="font-mono text-xs">{t.nip ?? t.nuptk ?? '—'}</span> },
                { key: 'employment_status', header: 'Status', render: (t) => t.employment_status ?? '—' },
                {
                  key: 'load',
                  header: 'Mengajar',
                  render: (t) => (t.assignment_count ? `${t.assignment_count} kelas-mapel${t.hours_per_week ? ` · ${t.hours_per_week} JP` : ''}` : <span className="text-slate-500">Belum ada</span>),
                },
                { key: 'guardian', header: 'Wali kelas', render: (t) => (t.guardian_class_name ? <Badge tone="violet"><ShieldCheck className="h-3 w-3" /> {t.guardian_class_name}</Badge> : '—') },
                {
                  key: 'account',
                  header: 'Akun',
                  render: (t) => (!t.is_active ? <Badge tone="red" dot>Nonaktif</Badge> : t.must_change_password ? <Badge tone="orange" dot>Belum login</Badge> : <Badge tone="green" dot>Aktif</Badge>),
                },
              ]}
              actions={(t) => (
                <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi"><MoreVertical className="h-4 w-4" /></Button>}>
                  <DropdownItem icon={Pencil} onClick={() => setModal(t)}>Ubah data</DropdownItem>
                  <DropdownItem icon={KeyRound} onClick={() => account.resetPassword(t)}>Reset password</DropdownItem>
                  <DropdownItem icon={t.is_active ? PowerOff : Power} danger={t.is_active} onClick={() => account.toggleStatus(t)}>
                    {t.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                  </DropdownItem>
                </Dropdown>
              )}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>

      <TeacherFormModal
        key={modal?.id ?? String(modal)}
        mode={modal}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null)
          refreshAll()
        }}
        onCreated={(cred) => {
          setModal(null)
          refreshAll()
          account.showCredential(cred)
        }}
      />
      <ImportModal open={importOpen} type="teacher" onClose={() => setImportOpen(false)} onDone={() => qc.invalidateQueries({ queryKey: MASTER })} />
      {account.element}
    </div>
  )
}
