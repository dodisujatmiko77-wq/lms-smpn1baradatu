import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, KeyRound, MoreVertical, Pencil, Plus, Power, PowerOff, School, Users, X } from 'lucide-react'
import { Avatar, Badge, Button, Card, DataTable, Dropdown, DropdownItem, EmptyState, ErrorState, FilterSelect, PageHeader, Pagination, SearchInput, SkeletonRows } from '@/components/ui'
import { ImportModal } from '@/features/import/ImportModal'
import { MASTER, keys } from '@/features/master/api'
import { useActiveSemester, useClasses, useInvalidateMaster } from '@/features/master/hooks'
import { useAccountActions } from '@/features/users/components/useAccountActions'
import { useDebounce } from '@/hooks/useDebounce'
import { STUDENT_STATUS } from '@/lib/academic'
import { supabase } from '@/lib/supabase'
import { StudentFormModal } from '../components/StudentFormModal'
import { PlaceStudentsModal } from '../components/PlaceStudentsModal'

const PAGE_SIZE = 25

async function fetchStudents({ page, search, classId, status }) {
  let q = supabase.from('v_students').select('*', { count: 'exact' }).order('full_name').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const term = search.replace(/[,()*%"\\]/g, ' ').trim()
  if (term) q = q.or(`full_name.ilike."*${term}*",nisn.ilike."*${term}*",nis.ilike."*${term}*"`)
  if (classId === 'none') q = q.is('class_id', null)
  else if (classId) q = q.eq('class_id', classId)
  if (status !== 'all') q = q.eq('status', status)
  const { data, count, error } = await q
  if (error) throw error
  return { rows: data, total: count ?? 0 }
}

export default function StudentsPage() {
  const active = useActiveSemester()
  const classes = useClasses(active.yearId, active.semesterId)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [status, setStatus] = useState('active')
  const [selected, setSelected] = useState(() => new Set())
  const debounced = useDebounce(search)
  const params = { page, search: debounced, classId, status }
  const qc = useQueryClient()
  const invalidate = useInvalidateMaster()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: keys.students(params),
    queryFn: () => fetchStudents(params),
    placeholderData: keepPreviousData,
  })
  const [modal, setModal] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const account = useAccountActions({ onChanged: invalidate })

  const setFilter = (fn) => (v) => {
    fn(v)
    setPage(1)
    setSelected(new Set())
  }
  const refreshAll = () => {
    invalidate()
    qc.invalidateQueries({ queryKey: ['admin'] })
  }

  const rows = data?.rows ?? []
  const filtered = debounced || classId || status !== 'active'
  const classList = classes.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Siswa"
        description={`NISN dipakai sebagai username login. Kelas mengikuti tahun pelajaran aktif${active.label ? ` (${active.label})` : ''}.`}
        actions={
          <>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Impor Excel</Button>
            <Button icon={Plus} onClick={() => setModal('new')}>Tambah siswa</Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 lg:flex-row">
          <SearchInput value={search} onChange={setFilter(setSearch)} placeholder="Cari nama, NISN, atau NIS…" className="lg:w-80" />
          <FilterSelect value={classId} onChange={setFilter(setClassId)} label="Kelas" className="lg:w-48">
            <option value="">Semua kelas</option>
            <option value="none">Belum punya kelas</option>
            {classList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect value={status} onChange={setFilter(setStatus)} label="Status siswa" className="lg:w-44">
            <option value="all">Semua status</option>
            {Object.entries(STUDENT_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </FilterSelect>
          {data && <p className="self-center text-sm text-slate-500 lg:ml-auto">{data.total} siswa</p>}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-primary-100 bg-primary-50 px-4 py-2.5 text-sm">
            <span className="font-medium text-primary-800">{selected.size} siswa dipilih</span>
            <Button size="sm" icon={School} onClick={() => setPlaceOpen(true)} disabled={classList.length === 0}>Tempatkan ke kelas</Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setSelected(new Set())}>Batal pilih</Button>
          </div>
        )}

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'Tidak ada siswa yang cocok' : 'Belum ada data siswa'}
            description={filtered ? 'Ubah kata kunci atau filter.' : 'Impor data siswa dari Excel (bisa langsung beserta kelasnya) atau tambahkan satu per satu.'}
            action={!filtered && <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Impor Excel</Button>}
          />
        ) : (
          <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <DataTable
              rows={rows}
              selectable
              selected={selected}
              onToggle={(id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })}
              onToggleAll={(all) => setSelected(all ? new Set(rows.map((r) => r.id)) : new Set())}
              columns={[
                {
                  key: 'name',
                  header: 'Siswa',
                  render: (s) => (
                    <div className="flex items-center gap-3">
                      <Avatar name={s.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{s.full_name}</p>
                        <p className="text-xs text-slate-500">NISN {s.nisn}{s.nis ? ` · NIS ${s.nis}` : ''}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'gender', header: 'L/P' },
                { key: 'class', header: 'Kelas', render: (s) => (s.class_name ? <span className="font-medium">{s.class_name}</span> : <Badge tone="orange">Belum ada</Badge>) },
                { key: 'status', header: 'Status', render: (s) => <Badge tone={STUDENT_STATUS[s.status].tone}>{STUDENT_STATUS[s.status].label}</Badge> },
                {
                  key: 'account',
                  header: 'Akun',
                  render: (s) => (!s.is_active ? <Badge tone="red" dot>Nonaktif</Badge> : s.must_change_password ? <Badge tone="orange" dot>Belum login</Badge> : <Badge tone="green" dot>Aktif</Badge>),
                },
              ]}
              actions={(s) => (
                <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi"><MoreVertical className="h-4 w-4" /></Button>}>
                  <DropdownItem icon={Pencil} onClick={() => setModal(s)}>Ubah data & kelas</DropdownItem>
                  <DropdownItem icon={KeyRound} onClick={() => account.resetPassword(s)}>Reset password</DropdownItem>
                  <DropdownItem icon={s.is_active ? PowerOff : Power} danger={s.is_active} onClick={() => account.toggleStatus(s)}>
                    {s.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                  </DropdownItem>
                </Dropdown>
              )}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => { setPage(p); setSelected(new Set()) }} />
          </div>
        )}
      </Card>

      <StudentFormModal
        key={modal?.id ?? String(modal)}
        mode={modal}
        classes={classList}
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
      <PlaceStudentsModal
        open={placeOpen}
        studentIds={[...selected]}
        classes={classList}
        onClose={() => setPlaceOpen(false)}
        onDone={() => {
          setPlaceOpen(false)
          setSelected(new Set())
          invalidate()
        }}
      />
      <ImportModal open={importOpen} type="student" classes={classList} onClose={() => setImportOpen(false)} onDone={() => qc.invalidateQueries({ queryKey: MASTER })} />
      {account.element}
    </div>
  )
}
