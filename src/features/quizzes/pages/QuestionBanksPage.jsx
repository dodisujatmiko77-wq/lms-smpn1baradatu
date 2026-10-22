import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileQuestion, Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { fetchBanks, qkeys } from '../api'
import { BankFormModal } from '../components/BankFormModal'

/** Daftar bank soal milik guru. */
export default function QuestionBanksPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: qkeys.banks, queryFn: fetchBanks })
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rows = (data ?? []).filter((b) => `${b.name} ${b.subject?.name}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Soal"
        description="Simpan soal per materi, lalu pakai ulang untuk kuis dan ujian di kelas mana pun yang Anda ampu."
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>Bank soal baru</Button>}
      />
      {(data?.length ?? 0) > 4 && <SearchInput value={search} onChange={setSearch} placeholder="Cari bank soal…" className="max-w-sm" />}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : isError ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="Belum ada bank soal"
            description="Buat bank soal untuk setiap bab/materi. Soal pilihan ganda, benar/salah, dan isian dinilai otomatis; esai dinilai manual."
            action={<Button icon={Plus} onClick={() => setOpen(true)}>Buat bank soal pertama</Button>}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={FileQuestion} title="Tidak ditemukan" description="Coba kata kunci lain." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <Link key={b.id} to={`/guru/bank-soal/${b.id}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white p-5 pl-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: b.subject?.color }} />
              <p className="text-xs font-medium" style={{ color: b.subject?.color }}>{b.subject?.name}{b.grade ? ` · Kelas ${b.grade}` : ''}</p>
              <p className="mt-1 font-semibold leading-snug text-slate-900">{b.name}</p>
              {b.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{b.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-4">
                <Badge tone="blue">{b.question_count} soal</Badge>
                <span className="flex items-center gap-1 text-xs text-slate-400">diubah {formatRelative(b.updated_at)} <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <BankFormModal key={String(open)} open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refetch() }} />
    </div>
  )
}
