import { useQuery } from '@tanstack/react-query'
import { Database, FileText, HardDrive, Link2 } from 'lucide-react'
import { Badge, Card, CardHeader, DataTable, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonRows, StatCard } from '@/components/ui'
import { MATERIAL_META } from '@/features/classroom/components/materials'
import { unwrap } from '@/lib/db'
import { formatBytes } from '@/lib/files'
import { supabase } from '@/lib/supabase'
import { cn, formatRelative } from '@/lib/utils'

// Kuota penyimpanan paket Supabase Free. Ubah bila sekolah memakai paket berbayar.
const QUOTA_BYTES = 1024 ** 3

async function fetchLargest() {
  return unwrap(
    await supabase
      .from('lesson_materials')
      .select('id, title, type, size_bytes, created_at, lesson:lessons(title), ta:teaching_assignments(class:classes(name), subject:subjects(name), teacher:teachers(profile:profiles(full_name)))')
      .not('storage_path', 'is', null)
      .order('size_bytes', { ascending: false })
      .limit(20),
  )
}

export default function FileManagementPage() {
  const usage = useQuery({ queryKey: ['admin', 'storage'], queryFn: async () => unwrap(await supabase.rpc('admin_storage_usage')) })
  const largest = useQuery({ queryKey: ['admin', 'storage', 'largest'], queryFn: fetchLargest })
  const u = usage.data
  const pct = u ? Math.min(100, (u.total_bytes / QUOTA_BYTES) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen File" description="Pantau pemakaian penyimpanan materi agar tidak melebihi kuota Supabase. Video sebaiknya selalu lewat YouTube." />
      {usage.isError ? (
        <Card><ErrorState error={usage.error} onRetry={usage.refetch} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Terpakai" value={u ? formatBytes(u.total_bytes) : ''} icon={HardDrive} tone={pct > 80 ? 'orange' : 'blue'} loading={usage.isLoading} hint={`dari ${formatBytes(QUOTA_BYTES)} (paket Free)`} />
            <StatCard label="Berkas tersimpan" value={u?.file_count} icon={FileText} tone="green" loading={usage.isLoading} hint="PDF, gambar, presentasi, dokumen" />
            <StatCard label="Video & tautan" value={u?.link_count} icon={Link2} tone="violet" loading={usage.isLoading} hint="Tidak memakai kuota penyimpanan" />
          </div>
          <Card>
            <CardHeader icon={Database} title="Kuota penyimpanan" description={u ? `${pct.toFixed(1)}% terpakai` : undefined} />
            <div className="space-y-4 p-5">
              {usage.isLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-accent-500' : 'bg-primary-500')} style={{ width: `${Math.max(pct, 0.5)}%` }} />
                  </div>
                  {pct > 70 && (
                    <p className="text-sm text-accent-700">
                      Penyimpanan hampir penuh. Pertimbangkan menurunkan batas ukuran unggah, mengarsipkan materi semester lalu, atau meningkatkan paket Supabase.
                    </p>
                  )}
                  {u?.by_subject?.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {u.by_subject.map((s) => (
                        <li key={s.subject} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="min-w-0 flex-1 truncate">{s.subject}</span>
                          <span className="text-xs text-slate-500">{s.count} berkas · {formatBytes(s.bytes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </Card>
        </>
      )}
      <Card>
        <CardHeader icon={FileText} title="Berkas terbesar" description="20 berkas yang paling banyak memakai kuota" />
        {largest.isLoading ? (
          <SkeletonRows rows={5} />
        ) : largest.isError ? (
          <ErrorState error={largest.error} onRetry={largest.refetch} />
        ) : largest.data.length === 0 ? (
          <EmptyState icon={FileText} title="Belum ada berkas" description="Berkas materi yang diunggah guru akan tampil di sini." />
        ) : (
          <DataTable
            rows={largest.data}
            columns={[
              {
                key: 'title',
                header: 'Berkas',
                render: (m) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{m.title}</p>
                    <p className="truncate text-xs text-slate-500">{m.lesson?.title}</p>
                  </div>
                ),
              },
              { key: 'type', header: 'Jenis', render: (m) => <Badge>{MATERIAL_META[m.type]?.label ?? m.type}</Badge> },
              { key: 'class', header: 'Kelas · Mapel', render: (m) => `${m.ta?.class?.name ?? '—'} · ${m.ta?.subject?.name ?? '—'}` },
              { key: 'teacher', header: 'Guru', render: (m) => m.ta?.teacher?.profile?.full_name ?? '—' },
              { key: 'size', header: 'Ukuran', render: (m) => <span className="font-medium">{formatBytes(m.size_bytes)}</span> },
              { key: 'created', header: 'Diunggah', render: (m) => formatRelative(m.created_at) },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
