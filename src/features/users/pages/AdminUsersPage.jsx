import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MoreVertical, Pencil, Plus, Power, PowerOff, Search, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, EmptyState, ErrorState, Pagination, SkeletonRows,
} from '@/components/ui'
import { inputClass } from '@/components/ui/Input'
import { useDebounce } from '@/hooks/useDebounce'
import { ROLE_LABELS } from '@/lib/auth'
import { toMessage } from '@/lib/errors'
import { cn, formatRelative } from '@/lib/utils'
import { USERS_KEY, adminUsers, listUsers, updateProfileAsAdmin } from '../api'
import { CreateUserModal } from '../components/CreateUserModal'
import { CredentialModal } from '../components/CredentialModal'
import { EditUserModal } from '../components/EditUserModal'

const PAGE_SIZE = 20
const ROLE_TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'student', label: 'Siswa' },
  { value: 'teacher', label: 'Guru' },
  { value: 'admin', label: 'Admin' },
]
const ROLE_TONE = { admin: 'violet', teacher: 'blue', student: 'orange' }

function RoleBadges({ roles }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.length === 0 && <Badge tone="red">Tanpa role</Badge>}
      {roles.map(({ role }) => (
        <Badge key={role} tone={ROLE_TONE[role]}>
          {ROLE_LABELS[role]}
        </Badge>
      ))}
    </div>
  )
}

function StatusBadge({ user }) {
  if (!user.is_active) return <Badge tone="red" dot>Nonaktif</Badge>
  if (user.must_change_password) return <Badge tone="orange" dot>Menunggu ganti password</Badge>
  return <Badge tone="green" dot>Aktif</Badge>
}

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const debounced = useDebounce(search)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [credential, setCredential] = useState(null)
  const [confirm, setConfirm] = useState(null) // { type: 'reset' | 'status', user }

  const params = { page, pageSize: PAGE_SIZE, search: debounced, role, status }
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: USERS_KEY })
    qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
  }

  const createUser = async (values) => {
    try {
      const res = await adminUsers({ action: 'create', ...values })
      toast.success(`Akun ${values.full_name} berhasil dibuat.`)
      setCreateOpen(false)
      setCredential({ title: 'Akun berhasil dibuat', full_name: values.full_name, username: res.username, password: res.password })
      invalidate()
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    }
  }

  const saveEdit = async (values) => {
    try {
      await updateProfileAsAdmin({ userId: editing.id, fullName: values.full_name, contactEmail: values.contact_email, phone: values.phone })
      const before = editing.user_roles.map((r) => r.role).sort().join()
      if (before !== [...values.roles].sort().join()) {
        await adminUsers({ action: 'set_roles', user_id: editing.id, roles: values.roles })
      }
      toast.success('Data akun diperbarui.')
      setEditing(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  const confirmAction = useMutation({
    mutationFn: async ({ type, user }) => {
      if (type === 'reset') return adminUsers({ action: 'reset_password', user_id: user.id })
      return adminUsers({ action: 'set_status', user_id: user.id, is_active: !user.is_active })
    },
    onSuccess: (res, { type, user }) => {
      if (type === 'reset') {
        setCredential({ title: 'Password berhasil direset', full_name: user.full_name, username: user.username, password: res.password })
      } else {
        toast.success(user.is_active ? `Akun ${user.full_name} dinonaktifkan.` : `Akun ${user.full_name} diaktifkan kembali.`)
      }
      setConfirm(null)
      invalidate()
    },
    onError: (e) => toast.error(toMessage(e)),
  })

  const rows = data?.rows ?? []
  const filtersActive = debounced || role !== 'all' || status !== 'all'

  const actions = (user) => (
    <Dropdown
      trigger={({ toggle }) => (
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={`Aksi untuk ${user.full_name}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      )}
    >
      <DropdownItem icon={Pencil} onClick={() => setEditing(user)}>
        Ubah data & role
      </DropdownItem>
      <DropdownItem icon={KeyRound} onClick={() => setConfirm({ type: 'reset', user })}>
        Reset password
      </DropdownItem>
      {user.id !== profile.id && (
        <DropdownItem icon={user.is_active ? PowerOff : Power} danger={user.is_active} onClick={() => setConfirm({ type: 'status', user })}>
          {user.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
        </DropdownItem>
      )}
    </Dropdown>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Akun Pengguna</h2>
          <p className="mt-1 text-sm text-slate-500">Kelola akun login guru, siswa, dan administrator. Semua tindakan tercatat di audit log.</p>
        </div>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>
          Tambah akun
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 scrollbar-thin">
            {ROLE_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setRole(t.value)
                  setPage(1)
                }}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
                  role === t.value ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Cari nama atau username…"
                className={cn(inputClass(false, true), 'h-10 pr-3.5')}
                aria-label="Cari akun"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className={cn(inputClass(false), 'h-10 pr-8 sm:w-40')}
              aria-label="Filter status"
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={filtersActive ? Users : UserPlus}
            title={filtersActive ? 'Tidak ada akun yang cocok' : 'Belum ada akun'}
            description={filtersActive ? 'Ubah kata kunci atau filter pencarian.' : 'Tambahkan akun guru dan siswa untuk mulai menggunakan LMS.'}
            action={!filtersActive && <Button icon={Plus} onClick={() => setCreateOpen(true)}>Tambah akun</Button>}
          />
        ) : (
          <div className={cn('transition-opacity', isFetching && 'opacity-60')}>
            {/* Tabel (tablet & desktop) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Pengguna</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Login terakhir</th>
                    <th className="w-12 px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{u.full_name}</p>
                            <p className="truncate text-xs text-slate-500">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <RoleBadges roles={u.user_roles} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge user={u} />
                      </td>
                      <td className="px-5 py-3 text-slate-500">{u.last_login_at ? formatRelative(u.last_login_at) : 'Belum pernah'}</td>
                      <td className="px-5 py-3 text-right">{actions(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu (HP) */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((u) => (
                <li key={u.id} className="flex items-start gap-3 p-4">
                  <Avatar name={u.full_name} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div>
                      <p className="truncate font-medium text-slate-900">{u.full_name}</p>
                      <p className="truncate text-xs text-slate-500">@{u.username}</p>
                    </div>
                    <RoleBadges roles={u.user_roles} />
                    <StatusBadge user={u} />
                  </div>
                  {actions(u)}
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={createUser} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} onSubmit={saveEdit} />
      <CredentialModal credential={credential} onClose={() => setCredential(null)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        loading={confirmAction.isPending}
        onConfirm={() => confirmAction.mutate(confirm)}
        tone={confirm?.type === 'status' && confirm.user.is_active ? 'danger' : 'primary'}
        title={
          confirm?.type === 'reset' ? 'Reset password?' : confirm?.user.is_active ? 'Nonaktifkan akun?' : 'Aktifkan akun?'
        }
        confirmLabel={confirm?.type === 'reset' ? 'Reset password' : confirm?.user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        message={
          confirm?.type === 'reset'
            ? `Password ${confirm.user.full_name} akan diganti dengan password sementara baru dan semua sesi login-nya diakhiri.`
            : confirm?.user.is_active
              ? `${confirm?.user.full_name} tidak akan bisa login sampai akunnya diaktifkan kembali. Data pembelajarannya tetap tersimpan.`
              : `${confirm?.user.full_name} akan dapat login kembali.`
        }
      />
    </div>
  )
}
