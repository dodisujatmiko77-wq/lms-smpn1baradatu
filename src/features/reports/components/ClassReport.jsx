import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Table2, Users } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows, Tabs } from '@/components/ui'
import { cn } from '@/lib/utils'
import { fetchClassSummary, pivotClassSummary, rkeys } from '../api'
import { ExportButtons } from './ExportButtons'
import { PercentBar, ScoreCell, fmt } from './ScoreCell'

/** Rekap kelas: siswa × mapel (nilai rata-rata atau penyelesaian materi). */
export function ClassReport({ classId, className, studentLink = true }) {
  const q = useQuery({ queryKey: rkeys.classSummary(classId), queryFn: () => fetchClassSummary(classId), enabled: Boolean(classId) })
  const [mode, setMode] = useState('nilai')
  if (!classId) return null
  if (q.isLoading) return <Card><SkeletonRows rows={6} /></Card>
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
  const { subjects, students, kkm } = pivotClassSummary(q.data ?? [])
  if (!students.length) return <Card><EmptyState icon={Users} title="Belum ada data" description="Kelas ini belum memiliki siswa atau penugasan mengajar di semester aktif." /></Card>

  const cellValue = (c) => (mode === 'nilai' ? c?.overall_avg : c?.lessons_total ? Math.round((c.lessons_done / c.lessons_total) * 1000) / 10 : null)
  const subjectAvg = (sid) => {
    const vals = students.map((s) => cellValue(s.cells[sid])).filter((v) => v != null).map(Number)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const build = () => {
    const columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Nama', key: 'name', width: 28 },
      { header: 'NISN', key: 'nisn', width: 13 },
      ...subjects.map((s) => ({ header: s.code || s.name, key: s.id, width: 9 })),
      { header: mode === 'nilai' ? 'Rata-rata' : 'Total %', key: 'avg', width: 10 },
      { header: 'Tugas terlewat', key: 'missing', width: 10 },
    ]
    const rows = students.map((s, i) => ({
      no: i + 1, name: s.full_name, nisn: s.nisn, missing: s.missing,
      avg: mode === 'nilai' ? s.avg : s.progress,
      ...Object.fromEntries(subjects.map((sub) => [sub.id, cellValue(s.cells[sub.id])])),
    }))
    return {
      fileName: `${mode === 'nilai' ? 'Rekap nilai' : 'Progress materi'} kelas ${className}`,
      title: `${mode === 'nilai' ? 'Rekap Nilai' : 'Progress Penyelesaian Materi'} — Kelas ${className}`,
      subtitle: `${mode === 'nilai' ? `Rata-rata nilai tugas (terbit) & kuis, skala 0–100. KKM ${kkm}.` : 'Persentase pertemuan yang diselesaikan siswa.'} Mapel: ${subjects.map((s) => `${s.code || s.name} = ${s.name}`).join(', ')}`,
      columns,
      rows,
    }
  }

  return (
    <Card>
      <CardHeader
        icon={Table2}
        title={`Rekap kelas ${className}`}
        description={mode === 'nilai' ? `Rata-rata semua penilaian per mapel (0–100). Merah = di bawah KKM ${kkm}.` : 'Persentase pertemuan yang sudah diselesaikan.'}
        action={<ExportButtons build={build} />}
      />
      <div className="border-b border-slate-100 px-5 py-3">
        <Tabs value={mode} onChange={setMode} tabs={[{ value: 'nilai', label: 'Nilai' }, { value: 'progress', label: 'Progress materi' }]} className="inline-flex" />
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Siswa</th>
              {subjects.map((s) => <th key={s.id} className="px-3 py-3 text-center" title={`${s.name} — ${s.teacher}`}>{s.code || s.name}</th>)}
              <th className="px-3 py-3 text-center">{mode === 'nilai' ? 'Rata-rata' : 'Total'}</th>
              <th className="px-3 py-3 text-center" title="Tugas lewat tenggat yang belum dikumpulkan">Terlewat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  {studentLink ? <Link to={`/laporan/siswa/${s.id}`} className="font-medium text-slate-900 hover:text-primary-700">{s.full_name}</Link> : <span className="font-medium text-slate-900">{s.full_name}</span>}
                  <span className="block text-xs text-slate-500">{s.nisn}</span>
                </td>
                {subjects.map((sub) => (
                  <td key={sub.id} className="px-3 py-2.5 text-center">
                    {mode === 'nilai' ? <ScoreCell value={s.cells[sub.id]?.overall_avg} kkm={kkm} /> : <span className="tabular-nums text-slate-700">{fmt(cellValue(s.cells[sub.id]), 0)}{cellValue(s.cells[sub.id]) != null && '%'}</span>}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">{mode === 'nilai' ? <ScoreCell value={s.avg} kkm={kkm} /> : <PercentBar value={s.progress} />}</td>
                <td className={cn('px-3 py-2.5 text-center tabular-nums', s.missing ? 'font-semibold text-red-600' : 'text-slate-500')}>{s.missing}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/60 text-xs">
              <td className="sticky left-0 bg-slate-50 px-4 py-2.5 font-semibold text-slate-600">Rata-rata kelas</td>
              {subjects.map((sub) => <td key={sub.id} className="px-3 py-2.5 text-center"><ScoreCell value={subjectAvg(sub.id)} kkm={mode === 'nilai' ? kkm : null} /></td>)}
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
