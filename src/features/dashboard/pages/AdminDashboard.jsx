import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  CheckCircle2, Circle, ClipboardList, GraduationCap, History, Library, LineChart, ListChecks,
  MonitorCheck, School, UserCog, UserRound, Users,
} from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, SkeletonRows, StatCard } from '@/components/ui'
import { actionLabel, actionTone } from '@/features/audit/actionLabels'
import { formatDate, formatRelative } from '@/lib/utils'
import { fetchSchoolStats, keys } from '@/features/master/api'
import { useActiveSemester } from '@/features/master/hooks'
import { fetchAdminStats, fetchRecentAudit } from '../api'
import { UpcomingModules } from '../components/UpcomingModules'
import { WelcomeBanner } from '../components/WelcomeBanner'

const UPCOMING = [
  { icon: ClipboardList, title: 'Tugas & persentase pengumpulan', description: 'Rekap pengumpulan seluruh kelas', stage: 4 },
  { icon: MonitorCheck, title: 'Grafik aktivitas pembelajaran', description: 'Aktivitas guru & siswa dari database', stage: 7 },
]

export default function AdminDashboard() {
  const settings = useSchoolSettings()
  const active = useActiveSemester()
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchAdminStats })
  const school = useQuery({ queryKey: keys.stats, queryFn: fetchSchoolStats })
  const sc = school.data
  const audit = useQuery({ queryKey: ['admin', 'audit', 'recent'], queryFn: () => fetchRecentAudit(6) })
  const s = stats.data

  const chartData = (s?.by_month ?? []).map((m) => ({
    bulan: formatDate(`${m.month}-01`, 'MMM yy'),
    'Akun baru': m.created,
    'Login aktif': m.logins,
  }))

  const checklist = [
    { label: 'Identitas sekolah diatur', done: Boolean(settings.npsn || settings.phone || settings.email), to: '/admin/pengaturan' },
    { label: 'Tahun pelajaran & semester aktif', done: Boolean(sc?.has_active_semester), to: '/admin/tahun-pelajaran' },
    { label: 'Mata pelajaran', done: (sc?.subjects ?? 0) > 0, to: '/admin/mapel' },
    { label: 'Kelas tahun pelajaran aktif', done: (sc?.classes ?? 0) > 0, to: '/admin/kelas' },
    { label: 'Data guru', done: (sc?.teachers ?? 0) > 0, to: '/admin/guru' },
    { label: 'Data siswa', done: (sc?.students_active ?? 0) > 0, to: '/admin/siswa' },
    { label: sc?.unplaced_students ? `Penempatan siswa (${sc.unplaced_students} belum punya kelas)` : 'Semua siswa punya kelas', done: (sc?.students_active ?? 0) > 0 && sc?.unplaced_students === 0, to: '/admin/siswa' },
    { label: sc?.classes_without_guardian ? `Wali kelas (${sc.classes_without_guardian} kelas belum)` : 'Wali kelas setiap kelas', done: (sc?.classes ?? 0) > 0 && sc?.classes_without_guardian === 0, to: '/admin/wali-kelas' },
    { label: 'Penugasan mengajar', done: (sc?.assignments ?? 0) > 0, to: '/admin/penugasan' },
    { label: 'Jadwal pelajaran', done: (sc?.schedules ?? 0) > 0, to: '/admin/jadwal' },
  ]

  return (
    <div className="space-y-6">
      <WelcomeBanner
        subtitle={
          active.label
            ? `Panel administrator ${settings.school_name} · Semester aktif ${active.label}.`
            : `Panel administrator ${settings.school_name}. Mulailah dengan mengatur tahun pelajaran & semester aktif.`
        }
      >
        <Link to="/admin/akun">
          <Button variant="accent" icon={UserCog}>
            Kelola akun
          </Button>
        </Link>
      </WelcomeBanner>

      {school.isError ? (
        <Card>
          <ErrorState error={school.error} onRetry={school.refetch} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Siswa aktif" value={sc?.students_active} icon={Users} tone="blue" loading={school.isLoading} hint={sc ? `${sc.enrolled} sudah ditempatkan di kelas` : undefined} />
          <StatCard label="Guru" value={sc?.teachers} icon={GraduationCap} tone="orange" loading={school.isLoading} hint={sc ? `${sc.assignments} penugasan mengajar` : undefined} />
          <StatCard label="Kelas" value={sc?.classes} icon={School} tone="green" loading={school.isLoading} hint="Tahun pelajaran aktif" />
          <StatCard label="Mata pelajaran" value={sc?.subjects} icon={Library} tone="violet" loading={school.isLoading} hint={s ? `${s.logged_in_7d} pengguna login 7 hari terakhir` : undefined} />
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
          <ul className="space-y-0.5 p-3">
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
