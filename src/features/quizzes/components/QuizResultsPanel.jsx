import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Eye, Users } from 'lucide-react'
import { Avatar, Badge, Button, Card, DataTable, EmptyState, ErrorState, FilterSelect, SkeletonRows } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { fetchQuizResults, qkeys } from '../api'
import { fmtScore, toHundred } from '../status'
import { AttemptDetailModal } from './AttemptDetailModal'

const FILTERS = {
  all: () => true,
  manual: (r) => r.needs_manual,
  not_started: (r) => r.attempts === 0,
  in_progress: (r) => r.last_status === 'in_progress',
  done: (r) => r.last_status === 'submitted',
}

function statusBadge(r) {
  if (r.attempts === 0) return <Badge tone="slate">Belum mengerjakan</Badge>
  if (r.last_status === 'in_progress') return <Badge tone="blue" dot>Sedang mengerjakan</Badge>
  if (r.needs_manual) return <Badge tone="orange">Esai perlu dinilai</Badge>
  return <Badge tone="green">Selesai</Badge>
}

async function exportExcel(quiz, rows) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Nilai')
  ws.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama', key: 'name', width: 32 },
    { header: 'NISN', key: 'nisn', width: 14 },
    { header: 'Percobaan', key: 'attempts', width: 10 },
    { header: 'Skor terbaik', key: 'score', width: 12 },
    { header: 'Skor maks', key: 'max', width: 10 },
    { header: 'Nilai (0–100)', key: 'hundred', width: 12 },
    { header: 'Keluar halaman', key: 'focus', width: 14 },
    { header: 'Keterangan', key: 'note', width: 24 },
  ]
  ws.getRow(1).font = { bold: true }
  rows.forEach((r, i) =>
    ws.addRow({
      no: i + 1,
      name: r.full_name,
      nisn: r.nisn,
      attempts: r.attempts,
      score: r.best_score == null ? '' : Number(r.best_score),
      max: r.max_score == null ? '' : Number(r.max_score),
      hundred: toHundred(r.best_score, r.max_score) ?? '',
      focus: r.focus_lost,
      note: r.attempts === 0 ? 'Belum mengerjakan' : r.needs_manual ? 'Esai belum dinilai' : r.auto_submitted ? 'Dikumpulkan otomatis' : '',
    }),
  )
  const buf = await wb.xlsx.writeBuffer()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  a.download = `Nilai ${quiz.title}.xlsx`.replace(/[\\/:*?"<>|]/g, '-')
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Hasil kuis per siswa + penilaian esai & reset percobaan. */
export function QuizResultsPanel({ quiz, canManage }) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: qkeys.results(quiz.id), queryFn: () => fetchQuizResults(quiz.id), refetchInterval: 30_000 })
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  if (isLoading) return <Card><SkeletonRows rows={6} /></Card>
  if (isError) return <Card><ErrorState error={error} onRetry={refetch} /></Card>
  const rows = data ?? []
  if (rows.length === 0) return <Card><EmptyState icon={Users} title="Belum ada siswa di kelas ini" /></Card>
  const done = rows.filter((r) => r.last_status === 'submitted')
  const scores = done.map((r) => toHundred(r.best_score, r.max_score)).filter((v) => v != null)
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const list = rows.filter(FILTERS[filter])
  const refresh = () => {
    refetch()
    qc.invalidateQueries({ queryKey: qkeys.course(quiz.teaching_assignment_id) })
    qc.invalidateQueries({ queryKey: qkeys.queue })
  }

  return (
    <Card>
      <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-4">
        <div><p className="text-xs text-slate-500">Sudah mengumpulkan</p><p className="font-display text-2xl font-semibold">{done.length}/{rows.length}</p></div>
        <div><p className="text-xs text-slate-500">Rata-rata (0–100)</p><p className="font-display text-2xl font-semibold">{avg == null ? '–' : fmtScore(avg)}</p></div>
        <div><p className="text-xs text-slate-500">Tertinggi / terendah</p><p className="font-display text-2xl font-semibold">{scores.length ? `${fmtScore(Math.max(...scores))} / ${fmtScore(Math.min(...scores))}` : '–'}</p></div>
        <div><p className="text-xs text-slate-500">Esai perlu dinilai</p><p className="font-display text-2xl font-semibold text-accent-600">{rows.filter((r) => r.needs_manual).length}</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div className="w-full sm:w-64">
        <FilterSelect value={filter} onChange={setFilter} label="Filter siswa">
          <option value="all">Semua siswa ({rows.length})</option>
          <option value="manual">Esai perlu dinilai ({rows.filter(FILTERS.manual).length})</option>
          <option value="not_started">Belum mengerjakan ({rows.filter(FILTERS.not_started).length})</option>
          <option value="in_progress">Sedang mengerjakan ({rows.filter(FILTERS.in_progress).length})</option>
          <option value="done">Selesai ({done.length})</option>
        </FilterSelect>
        </div>
        <Button variant="outline" size="sm" icon={Download} onClick={() => exportExcel(quiz, rows)}>Unduh nilai (Excel)</Button>
      </div>
      <DataTable
        rows={list}
        rowKey={(r) => r.student_id}
        onRowClick={(r) => r.last_attempt_id && setDetail(r)}
        columns={[
          {
            key: 'name',
            header: 'Siswa',
            render: (r) => (
              <div className="flex items-center gap-3">
                <Avatar name={r.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{r.full_name}</p>
                  <p className="text-xs text-slate-500">NISN {r.nisn}</p>
                </div>
              </div>
            ),
          },
          { key: 'status', header: 'Status', render: statusBadge },
          {
            key: 'score',
            header: 'Nilai terbaik',
            render: (r) =>
              r.best_score == null ? '—' : (
                <span><span className="font-semibold text-slate-900">{fmtScore(toHundred(r.best_score, r.max_score))}</span> <span className="text-xs text-slate-500">({fmtScore(r.best_score)}/{fmtScore(r.max_score)})</span></span>
              ),
          },
          { key: 'attempts', header: 'Percobaan', render: (r) => `${r.attempts}/${quiz.max_attempts}` },
          {
            key: 'focus',
            header: 'Keluar halaman',
            render: (r) => (r.focus_lost > 0 ? <span className="inline-flex items-center gap-1 text-accent-700"><AlertTriangle className="h-3.5 w-3.5" /> {r.focus_lost}×</span> : r.attempts ? '0' : '—'),
          },
          { key: 'at', header: 'Dikumpulkan', render: (r) => (r.last_submitted_at ? <span className="text-xs">{formatDate(r.last_submitted_at, 'd MMM HH:mm')}{r.auto_submitted && <span className="block text-slate-400">otomatis (waktu habis)</span>}</span> : '—') },
          { key: 'act', header: '', render: (r) => r.last_attempt_id && <Button variant="ghost" size="sm" icon={Eye}>Lihat</Button> },
        ]}
      />
      {detail && <AttemptDetailModal row={detail} quiz={quiz} canManage={canManage} onClose={() => setDetail(null)} onChanged={refresh} />}
    </Card>
  )
}
