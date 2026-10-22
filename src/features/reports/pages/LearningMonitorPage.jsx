import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, MonitorCheck } from 'lucide-react'
import { Badge, Card, DataTable, EmptyState, ErrorState, FilterSelect, PageHeader, SearchInput, SkeletonRows, StatCard } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { fetchLearningMonitor, rkeys } from '../api'
import { ExportButtons } from '../components/ExportButtons'
import { PercentBar } from '../components/ScoreCell'

const FILTERS = {
  all: () => true,
  empty: (r) => r.lessons_published === 0,
  idle: (r) => !r.last_teacher_activity || new Date(r.last_teacher_activity) < new Date(Date.now() - 14 * 86400_000),
  low: (r) => r.avg_completion != null && Number(r.avg_completion) < 50,
}

/** Monitoring pembelajaran semua ruang kelas (admin). */
export default function LearningMonitorPage() {
  const q = useQuery({ queryKey: rkeys.learning, queryFn: fetchLearningMonitor })
  const [filter, setFilter] = useState('all')
  const [cls, setCls] = useState('')
  const [search, setSearch] = useState('')
  const all = q.data ?? []
  const classes = [...new Map(all.map((r) => [r.class_id, r.class_name])).entries()]
  const rows = all
    .filter(FILTERS[filter])
    .filter((r) => !cls || r.class_id === cls)
    .filter((r) => `${r.subject_name} ${r.teacher_name} ${r.class_name}`.toLowerCase().includes(search.trim().toLowerCase()))
  const build = () => ({
    fileName: 'Monitoring pembelajaran',
    title: 'Monitoring Pembelajaran per Kelas-Mapel',
    subtitle: `${rows.length} ruang kelas`,
    columns: [
      { header: 'Kelas', key: 'class_name', width: 9 },
      { header: 'Mapel', key: 'subject_name', width: 20 },
      { header: 'Guru', key: 'teacher_name', width: 24 },
      { header: 'Siswa', key: 'student_count', width: 7 },
      { header: 'Materi terbit', key: 'lessons_published', width: 9 },
      { header: 'Tugas', key: 'tasks_published', width: 7 },
      { header: 'Kuis', key: 'quizzes_published', width: 7 },
      { header: 'Penyelesaian %', key: 'avg_completion', width: 11 },
      { header: 'Siswa aktif 7 hari', key: 'active_students_7d', width: 11 },
      { header: 'Aktivitas guru terakhir', key: 'last', width: 18 },
    ],
    rows: rows.map((r) => ({ ...r, avg_completion: r.avg_completion == null ? null : Number(r.avg_completion), last: r.last_teacher_activity ? new Date(r.last_teacher_activity).toLocaleDateString('id-ID') : 'Belum ada' })),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring Pembelajaran" description="Kelengkapan materi, tugas, kuis, dan keaktifan setiap kelas-mapel pada semester aktif." actions={<ExportButtons build={build} disabled={!rows.length} />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ruang kelas" value={all.length} icon={MonitorCheck} tone="blue" loading={q.isLoading} hint="Kelas × mapel semester aktif" />
        <StatCard label="Belum ada materi" value={all.filter(FILTERS.empty).length} icon={AlertTriangle} tone="orange" loading={q.isLoading} hint="Perlu diingatkan" />
        <StatCard label="Guru tidak aktif 14 hari" value={all.filter(FILTERS.idle).length} icon={AlertTriangle} tone="violet" loading={q.isLoading} hint="Tanpa unggahan/penilaian" />
        <StatCard label="Penyelesaian < 50%" value={all.filter(FILTERS.low).length} icon={AlertTriangle} tone="green" loading={q.isLoading} hint="Rata-rata siswa" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="sm:w-44">
          <FilterSelect value={cls} onChange={setCls} label="Kelas">
            <option value="">Semua kelas</option>
            {classes.map(([id, name]) => <option key={id} value={id}>Kelas {name}</option>)}
          </FilterSelect>
        </div>
        <div className="sm:w-60">
          <FilterSelect value={filter} onChange={setFilter} label="Filter">
            <option value="all">Semua ruang kelas</option>
            <option value="empty">Belum ada materi terbit</option>
            <option value="idle">Guru tidak aktif 14 hari</option>
            <option value="low">Penyelesaian di bawah 50%</option>
          </FilterSelect>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari mapel atau guru…" className="sm:w-64" />
      </div>
      <Card>
        {q.isLoading ? (
          <SkeletonRows rows={6} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={MonitorCheck} title="Tidak ada data" description="Buat penugasan mengajar pada semester aktif agar ruang kelas muncul di sini." />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.teaching_assignment_id}
            columns={[
              {
                key: 'mapel',
                header: 'Kelas · Mapel',
                render: (r) => (
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.subject_color }} />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{r.class_name} · {r.subject_name}</p>
                      <p className="text-xs text-slate-500">{r.teacher_name}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'konten', header: 'Materi · Tugas · Kuis', render: (r) => (r.lessons_published === 0 ? <Badge tone="orange">Belum ada materi</Badge> : <span className="tabular-nums">{r.lessons_published} · {r.tasks_published} · {r.quizzes_published}</span>) },
              { key: 'progress', header: 'Penyelesaian', render: (r) => <PercentBar value={r.avg_completion} /> },
              { key: 'aktif', header: 'Siswa aktif 7 hr', render: (r) => <span className="tabular-nums">{r.active_students_7d}/{r.student_count}</span> },
              { key: 'guru', header: 'Aktivitas guru', render: (r) => (r.last_teacher_activity ? <span className={FILTERS.idle(r) ? 'text-accent-700' : ''}>{formatRelative(r.last_teacher_activity)}</span> : <Badge tone="slate">Belum ada</Badge>) },
              { key: 'buka', header: '', render: (r) => <Link to={`/admin/laporan?tab=mapel&ta=${r.teaching_assignment_id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">Rekap nilai</Link> },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
