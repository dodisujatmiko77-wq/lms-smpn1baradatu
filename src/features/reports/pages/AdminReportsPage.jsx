import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { Card, CardHeader, DataTable, EmptyState, ErrorState, FilterSelect, PageHeader, SkeletonRows, Tabs } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { fetchLearningMonitor, fetchTeacherActivity, rkeys } from '../api'
import { ActivityChart } from '../components/ActivityChart'
import { ClassReport } from '../components/ClassReport'
import { ExportButtons } from '../components/ExportButtons'
import { TaGradesReport } from '../components/TaGradesReport'
import { useReportClasses } from '../hooks'

function TeacherActivity() {
  const [days, setDays] = useState('30')
  const q = useQuery({ queryKey: rkeys.teachers(days), queryFn: () => fetchTeacherActivity(Number(days)) })
  const rows = q.data ?? []
  const build = () => ({
    fileName: `Keaktifan guru ${days} hari`,
    title: `Keaktifan Guru — ${days} hari terakhir`,
    columns: [
      { header: 'Nama', key: 'full_name', width: 28 },
      { header: 'NIP', key: 'nip', width: 20 },
      { header: 'Kelas-mapel', key: 'classes', width: 10 },
      { header: 'Materi', key: 'lessons', width: 8 },
      { header: 'Tugas', key: 'tasks', width: 8 },
      { header: 'Kuis', key: 'quizzes', width: 8 },
      { header: 'Penilaian', key: 'grades', width: 9 },
      { header: 'Forum & pengumuman', key: 'forum', width: 12 },
      { header: 'Aktif terakhir', key: 'last', width: 16 },
    ],
    rows: rows.map((r) => ({ ...r, last: r.last_active_at ? new Date(r.last_active_at).toLocaleDateString('id-ID') : 'Belum ada' })),
  })
  return (
    <Card>
      <CardHeader
        icon={Users}
        title="Keaktifan guru"
        description="Jumlah materi/tugas/kuis yang diterbitkan, penilaian, dan tulisan forum."
        action={
          <div className="flex gap-2">
            <div className="w-32">
              <FilterSelect value={days} onChange={setDays} label="Rentang">
                <option value="7">7 hari</option>
                <option value="30">30 hari</option>
                <option value="90">90 hari</option>
              </FilterSelect>
            </div>
            <ExportButtons build={build} disabled={!rows.length} />
          </div>
        }
      />
      {q.isLoading ? (
        <SkeletonRows rows={5} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada guru aktif" />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.teacher_id}
          columns={[
            { key: 'nama', header: 'Guru', render: (r) => <div><p className="font-medium text-slate-900">{r.full_name}</p><p className="text-xs text-slate-500">{r.classes} kelas-mapel</p></div> },
            { key: 'konten', header: 'Materi · Tugas · Kuis', render: (r) => <span className="tabular-nums">{r.lessons} · {r.tasks} · {r.quizzes}</span> },
            { key: 'nilai', header: 'Penilaian', render: (r) => <span className="tabular-nums">{r.grades}</span> },
            { key: 'forum', header: 'Forum', render: (r) => <span className="tabular-nums">{r.forum}</span> },
            { key: 'last', header: 'Aktif terakhir', render: (r) => (r.last_active_at ? formatRelative(r.last_active_at) : <span className="text-slate-400">Belum ada</span>) },
          ]}
        />
      )}
    </Card>
  )
}

/** Laporan admin: aktivitas, rekap kelas, rekap per mapel. */
export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams()
  const tab = ['kelas', 'mapel'].includes(params.get('tab')) ? params.get('tab') : 'aktivitas'
  const { classes, current, setPicked, isLoading } = useReportClasses()
  const tas = useQuery({ queryKey: rkeys.learning, queryFn: fetchLearningMonitor, enabled: tab === 'mapel' })
  const taId = params.get('ta') ?? tas.data?.[0]?.teaching_assignment_id ?? null
  const ta = tas.data?.find((r) => r.teaching_assignment_id === taId)
  const setTab = (v) => setParams(v === 'aktivitas' ? {} : { tab: v }, { replace: true })

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan" description="Data diambil langsung dari aktivitas & penilaian di LMS (semester aktif). Semua tabel dapat diunduh ke Excel atau PDF." />
      <Tabs value={tab} onChange={setTab} className="inline-flex" tabs={[{ value: 'aktivitas', label: 'Aktivitas' }, { value: 'kelas', label: 'Rekap kelas' }, { value: 'mapel', label: 'Rekap per mapel' }]} />
      {tab === 'aktivitas' ? (
        <div className="space-y-6">
          <ActivityChart title="Aktivitas pembelajaran sekolah" />
          <TeacherActivity />
        </div>
      ) : tab === 'kelas' ? (
        <div className="space-y-4">
          <div className="sm:w-56">
            <FilterSelect value={current?.id ?? ''} onChange={setPicked} label="Kelas">
              {classes.map((c) => <option key={c.id} value={c.id}>Kelas {c.name} ({c.student_count} siswa)</option>)}
            </FilterSelect>
          </div>
          {isLoading ? <SkeletonRows rows={5} /> : current ? <ClassReport key={current.id} classId={current.id} className={current.name} /> : <Card><EmptyState icon={Users} title="Belum ada kelas aktif" /></Card>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="sm:w-96">
            <FilterSelect value={taId ?? ''} onChange={(v) => setParams({ tab: 'mapel', ta: v }, { replace: true })} label="Kelas-mapel">
              {(tas.data ?? []).map((r) => <option key={r.teaching_assignment_id} value={r.teaching_assignment_id}>{r.class_name} · {r.subject_name} — {r.teacher_name}</option>)}
            </FilterSelect>
          </div>
          {tas.isLoading ? <SkeletonRows rows={5} /> : ta ? <TaGradesReport key={taId} taId={taId} label={`${ta.subject_name} kelas ${ta.class_name}`} /> : <Card><EmptyState icon={Users} title="Belum ada kelas-mapel" /></Card>}
        </div>
      )}
    </div>
  )
}
