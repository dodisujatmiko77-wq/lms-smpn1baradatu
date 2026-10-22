import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, FileQuestion, Table2 } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { fetchTaGrades, rkeys } from '../api'
import { ExportButtons } from './ExportButtons'
import { ScoreCell, fmt } from './ScoreCell'

/** Rekap nilai satu ruang kelas: setiap tugas & kuis sebagai kolom (nilai 0–100). */
export function TaGradesReport({ taId, label }) {
  const q = useQuery({ queryKey: rkeys.taGrades(taId), queryFn: () => fetchTaGrades(taId), enabled: Boolean(taId) })
  if (!taId) return null
  if (q.isLoading) return <Card><SkeletonRows rows={6} /></Card>
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={q.refetch} /></Card>
  const { columns, students, kkm } = q.data
  if (!columns.length) return <Card><EmptyState icon={Table2} title="Belum ada tugas atau kuis terbit" description="Rekap nilai muncul setelah tugas/kuis diterbitkan dan dinilai." /></Card>

  const avgOf = (s) => {
    const vals = columns.map((c) => s.scores[c.id]?.pct).filter((v) => v != null).map(Number)
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
  }
  const build = () => ({
    fileName: `Rekap nilai ${label}`,
    title: `Rekap Nilai — ${label}`,
    subtitle: `Nilai skala 0–100. KKM ${kkm}. Kolom: ${columns.map((c, i) => `${i + 1}=${c.title}`).join('; ')}`,
    columns: [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Nama', key: 'name', width: 28 },
      { header: 'NISN', key: 'nisn', width: 13 },
      ...columns.map((c, i) => ({ header: `${c.kind === 'quiz' ? 'K' : 'T'}${i + 1}`, key: c.id, width: 7 })),
      { header: 'Rata-rata', key: 'avg', width: 10 },
      { header: 'Belum kumpul', key: 'missing', width: 10 },
    ],
    rows: students.map((s, i) => ({ no: i + 1, name: s.full_name, nisn: s.nisn, avg: avgOf(s), missing: s.missing, ...Object.fromEntries(columns.map((c) => [c.id, s.scores[c.id]?.pct ?? null])) })),
  })

  return (
    <Card>
      <CardHeader icon={Table2} title="Rekap nilai" description={`T = tugas, K = kuis. Nilai 0–100; merah di bawah KKM ${kkm}; abu-abu = belum diterbitkan/esai belum dinilai.`} action={<ExportButtons build={build} />} />
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left uppercase tracking-wide">Siswa</th>
              {columns.map((c, i) => (
                <th key={c.id} className="max-w-28 px-2 py-3 text-center font-medium" title={`${c.title} · ${formatDate(c.date, 'd MMM yyyy')}`}>
                  <span className={cn('inline-flex items-center gap-1', c.kind === 'quiz' ? 'text-violet-700' : 'text-accent-700')}>
                    {c.kind === 'quiz' ? <FileQuestion className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                    {c.kind === 'quiz' ? 'K' : 'T'}{i + 1}
                  </span>
                  <span className="block truncate text-[11px] font-normal text-slate-500">{c.title}</span>
                </th>
              ))}
              <th className="px-3 py-3 text-center uppercase tracking-wide">Rata-rata</th>
              <th className="px-3 py-3 text-center uppercase tracking-wide">Belum kumpul</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  <Link to={`/laporan/siswa/${s.id}`} className="font-medium text-slate-900 hover:text-primary-700">{s.full_name}</Link>
                  <span className="block text-xs text-slate-500">{s.nisn}</span>
                </td>
                {columns.map((c) => {
                  const v = s.scores[c.id]
                  return <td key={c.id} className="px-2 py-2.5 text-center"><ScoreCell value={v?.pct} kkm={kkm} muted={v && !v.published} /></td>
                })}
                <td className="px-3 py-2.5 text-center"><ScoreCell value={avgOf(s)} kkm={kkm} /></td>
                <td className={cn('px-3 py-2.5 text-center tabular-nums', s.missing ? 'font-semibold text-red-600' : 'text-slate-500')}>{fmt(s.missing, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
