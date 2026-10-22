import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Award, BookOpenCheck, ClipboardList, Phone, UserRound } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { TASK_STATUS, TaskStatusBadge } from '@/features/tasks/status'
import { formatDate, formatRelative } from '@/lib/utils'
import { fetchStudentReport, rkeys } from '../api'
import { ExportButtons } from '../components/ExportButtons'
import { PercentBar, ScoreCell, fmt } from '../components/ScoreCell'

/** Laporan satu siswa (wali kelas: semua mapel; guru mapel: mapelnya; admin: semua). */
export default function StudentReportPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: rkeys.student(studentId), queryFn: () => fetchStudentReport(studentId) })

  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
  const r = q.data
  const st = r.student
  const vals = r.subjects.map((s) => s.overall_avg).filter((v) => v != null).map(Number)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  const done = r.subjects.reduce((n, s) => n + s.lessons_done, 0)
  const total = r.subjects.reduce((n, s) => n + s.lessons_total, 0)
  const missing = r.tasks.filter((t) => t.status === 'missing')

  const build = () => ({
    fileName: `Laporan ${st.full_name}`,
    title: `Laporan Belajar — ${st.full_name}`,
    subtitle: `NISN ${st.nisn} · Kelas ${r.class.name} · KKM ${r.kkm} · Rata-rata ${fmt(avg)} · Materi ${total ? Math.round((done / total) * 100) : 0}% · Tugas terlewat ${missing.length}`,
    columns: [
      { header: 'Mata pelajaran', key: 'subject_name', width: 22 },
      { header: 'Guru', key: 'teacher_name', width: 24 },
      { header: 'Nilai tugas', key: 'task_avg', width: 10 },
      { header: 'Nilai kuis', key: 'quiz_avg', width: 10 },
      { header: 'Rata-rata', key: 'overall_avg', width: 10 },
      { header: 'Tugas terlewat', key: 'task_missing', width: 10 },
      { header: 'Kuis terlewat', key: 'quiz_missed', width: 10 },
      { header: 'Materi selesai', key: 'materi', width: 11 },
    ],
    rows: r.subjects.map((s) => ({ ...s, task_avg: s.task_avg, quiz_avg: s.quiz_avg, overall_avg: s.overall_avg, materi: `${s.lessons_done}/${s.lessons_total}` })),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2" onClick={() => navigate(-1)}>Kembali</Button>
        <ExportButtons build={build} />
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={st.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{st.full_name}</h2>
            <p className="text-sm text-slate-500">NISN {st.nisn}{st.nis && ` · NIS ${st.nis}`} · Kelas {r.class.name}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> Aktif terakhir {r.last_activity_at ? formatRelative(r.last_activity_at) : 'belum pernah'} · {r.activity_14d} aktivitas dalam 14 hari</span>
              {st.parent_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {st.parent_name ?? 'Orang tua'}: {st.parent_phone}</span>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-violet-50 px-3 py-2"><p className="text-xs text-violet-700">Rata-rata</p><p className="font-display text-xl font-semibold"><ScoreCell value={avg} kkm={r.kkm} /></p></div>
            <div className="rounded-xl bg-primary-50 px-3 py-2"><p className="text-xs text-primary-700">Materi</p><p className="font-display text-xl font-semibold text-slate-900">{total ? Math.round((done / total) * 100) : 0}%</p></div>
            <div className="rounded-xl bg-red-50 px-3 py-2"><p className="text-xs text-red-700">Terlewat</p><p className="font-display text-xl font-semibold text-slate-900">{missing.length}</p></div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={BookOpenCheck} title="Per mata pelajaran" description={`Nilai 0–100 (tugas yang sudah terbit & kuis yang sudah dinilai). Merah = di bawah KKM ${r.kkm}.`} />
        {r.subjects.length === 0 ? (
          <EmptyState icon={BookOpenCheck} title="Belum ada data" />
        ) : (
          <DataTable
            rows={r.subjects}
            rowKey={(s) => s.teaching_assignment_id}
            columns={[
              { key: 'm', header: 'Mapel', render: (s) => <div className="flex items-center gap-2.5"><span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: s.subject_color }} /><div><p className="font-medium text-slate-900">{s.subject_name}</p><p className="text-xs text-slate-500">{s.teacher_name}</p></div></div> },
              { key: 't', header: 'Tugas', render: (s) => <span><ScoreCell value={s.task_avg} kkm={r.kkm} /> <span className="text-xs text-slate-400">({s.task_count}/{s.task_total})</span></span> },
              { key: 'q', header: 'Kuis', render: (s) => <span><ScoreCell value={s.quiz_avg} kkm={r.kkm} /> <span className="text-xs text-slate-400">({s.quiz_count})</span></span> },
              { key: 'a', header: 'Rata-rata', render: (s) => <ScoreCell value={s.overall_avg} kkm={r.kkm} /> },
              { key: 'p', header: 'Materi', render: (s) => <PercentBar value={s.lessons_total ? (s.lessons_done / s.lessons_total) * 100 : null} /> },
              { key: 'x', header: 'Terlewat', render: (s) => (s.task_missing + s.quiz_missed ? <Badge tone="red">{s.task_missing} tugas · {s.quiz_missed} kuis</Badge> : <span className="text-slate-400">–</span>) },
            ]}
          />
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={ClipboardList} title="Tugas" description={`${r.tasks.length} tugas · ${missing.length} terlewat`} />
          {r.tasks.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">Belum ada tugas.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
              {r.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.subject_name} · tenggat {formatDate(t.due_at, 'd MMM yyyy')}</p>
                  </div>
                  {t.status === 'pending' ? <Badge tone="slate">Belum tenggat</Badge> : TASK_STATUS[t.status] && <TaskStatusBadge status={t.status} />}
                  {t.score != null && <ScoreCell value={t.score} kkm={r.kkm} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader icon={BookOpenCheck} title="Kuis & ujian" />
            {r.quizzes.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Belum ada kuis.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
                {r.quizzes.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{x.title}</p>
                      <p className="text-xs text-slate-500">{x.subject_name} · ditutup {formatDate(x.close_at, 'd MMM yyyy')}</p>
                    </div>
                    {x.attempts === 0 ? (new Date(x.close_at) < new Date() ? <Badge tone="red">Tidak dikerjakan</Badge> : <Badge tone="slate">Belum</Badge>) : x.pending ? <Badge tone="violet">Esai dinilai</Badge> : <ScoreCell value={x.pct} kkm={r.kkm} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader icon={Award} title="Badge semester ini" />
            {r.badges.length === 0 ? (
              <p className="px-5 py-5 text-center text-sm text-slate-500">Belum ada badge.</p>
            ) : (
              <div className="flex flex-wrap gap-2 p-4">{r.badges.map((b) => <span key={b.name} className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: b.color }}>{b.name}</span>)}</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
