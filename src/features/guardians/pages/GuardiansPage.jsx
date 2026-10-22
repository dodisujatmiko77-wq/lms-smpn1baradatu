import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader, SkeletonRows } from '@/components/ui'
import { useActiveSemester, useClasses } from '@/features/master/hooks'
import { GuardianSelect } from '../components/GuardianSelect'

export default function GuardiansPage() {
  const active = useActiveSemester()
  const { data, isLoading, isError, error, refetch } = useClasses(active.yearId, active.semesterId)

  if (!active.semesterId) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="Belum ada semester aktif" description="Wali kelas ditetapkan per semester." action={<Link to="/admin/tahun-pelajaran"><Button>Ke Tahun Pelajaran</Button></Link>} />
      </Card>
    )
  }

  const rows = data ?? []
  const counts = rows.reduce((m, c) => (c.guardian ? m.set(c.guardian.teacher_id, (m.get(c.guardian.teacher_id) ?? 0) + 1) : m), new Map())
  const missing = rows.filter((c) => !c.guardian).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wali Kelas"
        description={`Semester aktif: ${active.label}. Guru yang ditetapkan otomatis mendapat menu Wali Kelas.`}
      >
        {rows.length > 0 && (
          <p className="mt-2 text-sm">
            {missing ? <Badge tone="orange">{missing} kelas belum memiliki wali kelas</Badge> : <Badge tone="green">Semua kelas sudah memiliki wali kelas</Badge>}
          </p>
        )}
      </PageHeader>
      <Card>
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Belum ada kelas" description="Buat kelas terlebih dahulu di menu Kelas." action={<Link to="/admin/kelas"><Button>Ke Kelas</Button></Link>} />
        ) : (
          <DataTable
            rows={rows}
            columns={[
              { key: 'name', header: 'Kelas', render: (c) => <span className="font-display text-base font-semibold">{c.name}</span> },
              { key: 'students', header: 'Siswa', render: (c) => `${c.student_count} siswa` },
              {
                key: 'guardian',
                header: 'Wali kelas',
                className: 'w-full md:w-96',
                render: (c) => (
                  <div className="space-y-1">
                    <GuardianSelect classId={c.id} classLabel={c.name} semesterId={active.semesterId} value={c.guardian?.teacher_id} className="w-full" />
                    {c.guardian && counts.get(c.guardian.teacher_id) > 1 && (
                      <p className="text-xs text-accent-600">Guru ini menjadi wali di {counts.get(c.guardian.teacher_id)} kelas.</p>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
