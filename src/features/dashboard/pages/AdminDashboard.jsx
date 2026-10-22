import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Activity, BookOpen, CheckCircle2, Circle, ClipboardList, GraduationCap, History, LineChart, ListChecks,
  MonitorCheck, School, ShieldCheck, UserCog, UserRound, Users,
} from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, SkeletonRows, StatCard } from '@/components/ui'
import { actionLabel, actionTone } from '@/features/audit/actionLabels'
import { formatDate, formatRelative } from '@/lib/utils'
import { fetchAdminStats, fetchRecentAudit } from '../api'
import { UpcomingModules } from '../components/UpcomingModules'
import { WelcomeBanner } from '../components/WelcomeBanner'

const UPCOMING = [
  { icon: School, title: 'Data kelas, mapel & tahun pelajaran', description: 'Data master dan penugasan mengajar', stage: 2 },
  { icon: BookOpen, title: 'Materi & ruang kelas digital', description: 'Jumlah materi aktif per mapel', stage: 3 },
  { icon: ClipboardList, title: 'Tugas & persentase pengumpulan', description: 'Rekap pengumpulan seluruh kelas', stage: 4 },
  { icon: MonitorCheck, title: 'Grafik aktivitas pembelajaran', description: 'Aktivitas guru & siswa dari database', stage: 7 },
]

export default function AdminDashboard() {
  const settings = useSchoolSettings()
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchAdminStats })
  const audit = useQuery({ queryKey: ['admin', 'audit', 'recent'], queryFn: () => fetchRecentAudit(6) })
  const s = stats.data

  const chartData = (s?.by_month ?? []).map((m) => ({
    bulan: formatDate(`${m.month}-01`, 'MMM yy'),
    'Akun baru': m.created,
    'Login aktif': m.logins,
  }))

  const checklist = [
    { label: 'Identitas sekolah diatur', done: Boolean(settings.npsn || settings.phone || settings.email), to: '/admin/pengaturan' },
    { label: 'Akun guru dibuat', done: (s?.teachers ?? 0) > 0, to: '/admin/akun' },
    { label: 'Akun siswa dibuat', done: (s?.students ?? 0) > 0, to: '/admin/akun' },
    { label: 'Data kelas & mapel (Tahap 2)', done: false },
  ]

  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle={`Panel administrator ${settings.school_name}. Pantau dan kelola seluruh sistem LMS dari sini.`}>
        <Link to="/admin/akun">
          <Button variant="accent" icon={UserCog}>
            Kelola akun
          </Button>
        </Link>
      </WelcomeBanner>

      {stats.isError ? (
        <Card>
          <ErrorState error={stats.error} onRetry={stats.refetch} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total siswa" value={s?.students} icon={Users} tone="blue" loading={stats.isLoading} hint="Akun dengan role siswa" />
          <StatCard label="Total guru" value={s?.teachers} icon={GraduationCap} tone="orange" loading={stats.isLoading} hint="Akun dengan role guru" />
          <StatCard label="Akun aktif" value={s?.active} icon={ShieldCheck} tone="green" loading={stats.isLoading} hint={s ? `${s.inactive} akun nonaktif` : undefined} />
          <StatCard label="Login 7 hari terakhir" value={s?.logged_in_7d} icon={Activity} tone="violet" loading={stats.isLoading} hint="Pengguna yang aktif minggu ini" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader icon={LineChart} title="Penggunaan LMS" description="Akun baru dan pengguna yang login per bulan (6 bulan terakhir)" />
          <CardBody>
            {stats.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.every((d) => d['Akun baru'] === 0 && d['Login aktif'] === 0) ? (
              <EmptyState icon={LineChart} title="Belum ada data penggunaan" description="Grafik terisi otomatis setelah akun dibuat dan pengguna mulai login." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Login aktif" stroke="#1d4ed8" strokeWidth={2} fill="url(#gBlue)" />
                    <Area type="monotone" dataKey="Akun baru" stroke="#f97316" strokeWidth={2} fill="url(#gOrange)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={ListChecks} title="Kesiapan sistem" description="Langkah awal agar LMS siap dipakai" />
          <ul className="space-y-1 p-3">
            {checklist.map((c) => {
              const content = (
                <>
                  {c.done ? <CheckCircle2 className="h-5 w-5 text-success-600" /> : <Circle className="h-5 w-5 text-slate-300" />}
                  <span className={c.done ? 'text-slate-500 line-through' : 'text-slate-700'}>{c.label}</span>
                </>
              )
              return (
                <li key={c.label}>
                  {c.to && !c.done ? (
                    <Link to={c.to} className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm hover:bg-slate-50">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2.5 py-2.5 text-sm">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={History}
            title="Aktivitas terkini"
            description="Tindakan penting yang tercatat di audit log"
            action={
              <Link to="/admin/audit-log" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Lihat semua
              </Link>
            }
          />
          {audit.isLoading ? (
            <SkeletonRows rows={4} />
          ) : audit.isError ? (
            <ErrorState error={audit.error} onRetry={audit.refetch} />
          ) : audit.data.length === 0 ? (
            <EmptyState icon={History} title="Belum ada aktivitas" description="Aktivitas seperti pembuatan akun akan tercatat di sini." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {audit.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">
                      <span className="font-medium">{a.actor?.full_name ?? 'Sistem'}</span>
                    </p>
                    <p className="text-xs text-slate-500">{formatRelative(a.created_at)}</p>
                  </div>
                  <Badge tone={actionTone(a.action)}>{actionLabel(a.action)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <UpcomingModules items={UPCOMING} />
      </div>
    </div>
  )
}
