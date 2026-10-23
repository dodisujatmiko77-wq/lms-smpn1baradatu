import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, ConfirmDialog, DataTable, EmptyState, ErrorState, SkeletonRows } from '@/components/ui'
import { TASK_BUCKET } from '@/features/tasks/api'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/files'
import { supabase } from '@/lib/supabase'

const KEY = ['admin', 'storage', 'submissions']

/**
 * Hapus berkas jawaban tugas dari semester yang sudah berakhir untuk menghemat kuota Storage.
 * Nilai, umpan balik, jawaban teks, dan tautan tetap tersimpan.
 */
export function SubmissionCleanup() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: KEY, queryFn: async () => unwrap(await supabase.rpc('admin_submission_files_by_semester')) })
  const [target, setTarget] = useState(null)
  const [progress, setProgress] = useState(null)

  const purge = async () => {
    const sem = target
    setProgress('…')
    try {
      const paths = unwrap(await supabase.rpc('admin_submission_file_paths', { p_semester_id: sem.semester_id }))
      for (let i = 0; i < paths.length; i += 100) {
        setProgress(`${Math.min(i + 100, paths.length)}/${paths.length}`)
        unwrap(await supabase.storage.from(TASK_BUCKET).remove(paths.slice(i, i + 100)))
      }
      const n = unwrap(await supabase.rpc('admin_mark_submission_files_purged', { p_semester_id: sem.semester_id, p_files: paths.length, p_bytes: sem.total_bytes }))
      toast.success(`${paths.length} berkas dari ${n} pengumpulan dihapus (${formatBytes(sem.total_bytes)} dibebaskan).`)
      setTarget(null)
      qc.invalidateQueries({ queryKey: ['admin', 'storage'] })
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setProgress(null)
    }
  }

  const rows = q.data ?? []
  return (
    <Card>
      <CardHeader icon={Archive} title="Bersihkan berkas jawaban semester lalu" description="Membebaskan kuota penyimpanan. Nilai, umpan balik, dan jawaban teks/tautan siswa tetap tersimpan." />
      {q.isLoading ? (
        <SkeletonRows rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Archive} title="Belum ada berkas jawaban" description="Ringkasan per semester akan muncul setelah siswa mengunggah jawaban tugas." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.semester_id}
          columns={[
            { key: 'label', header: 'Semester', render: (r) => <span className="font-medium text-slate-900">{r.label}</span> },
            { key: 'status', header: 'Status', render: (r) => (r.is_active ? <Badge tone="green">Aktif</Badge> : r.ended ? <Badge tone="slate">Sudah berakhir</Badge> : <Badge tone="blue">Belum berakhir</Badge>) },
            { key: 'files', header: 'Berkas', render: (r) => `${r.files} berkas · ${r.submissions} pengumpulan` },
            { key: 'size', header: 'Ukuran', render: (r) => <span className="font-medium">{formatBytes(r.total_bytes)}</span> },
            {
              key: 'act',
              header: '',
              render: (r) =>
                !r.is_active && r.ended && r.files > 0 ? (
                  <Button size="sm" variant="outline" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setTarget(r)}>Bersihkan</Button>
                ) : r.purged > 0 && r.files === 0 ? (
                  <span className="text-xs text-slate-500">Sudah dibersihkan</span>
                ) : null,
            },
          ]}
        />
      )}
      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => !progress && setTarget(null)}
        onConfirm={purge}
        loading={Boolean(progress)}
        title={`Hapus berkas jawaban ${target?.label ?? ''}?`}
        confirmLabel={progress ? `Menghapus ${progress}` : 'Hapus berkas'}
        message={target && `${target.files} berkas (${formatBytes(target.total_bytes)}) dari ${target.submissions} pengumpulan akan dihapus permanen dari penyimpanan. Unduh rekap nilai terlebih dahulu bila diperlukan. Nilai dan jawaban teks tidak terhapus. Tindakan ini tercatat di Audit Log.`}
      />
    </Card>
  )
}
