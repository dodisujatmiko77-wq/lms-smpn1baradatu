import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, FileQuestion, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ConfirmDialog, Dropdown, DropdownItem, EmptyState, ErrorState, FilterSelect, Skeleton } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { deleteBank, deleteQuestion, duplicateQuestion, fetchBank, fetchQuestions, qkeys } from '../api'
import { BankFormModal } from '../components/BankFormModal'
import { QuestionMeta, QuestionView } from '../components/QuestionCard'
import { QuestionFormModal } from '../components/QuestionFormModal'
import { QUESTION_TYPES, fmtScore } from '../status'

/** Detail bank soal: kelola soal. */
export default function QuestionBankPage() {
  const { bankId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const bank = useQuery({ queryKey: qkeys.bank(bankId), queryFn: () => fetchBank(bankId) })
  const questions = useQuery({ queryKey: qkeys.questions(bankId), queryFn: () => fetchQuestions(bankId) })
  const [form, setForm] = useState(null) // 'new' | question
  const [editBank, setEditBank] = useState(false)
  const [remove, setRemove] = useState(null)
  const [removeBank, setRemoveBank] = useState(false)
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState('')

  const refresh = () => {
    questions.refetch()
    bank.refetch()
    qc.invalidateQueries({ queryKey: qkeys.banks })
  }
  const run = async (fn, ok) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (bank.isLoading) return <Skeleton className="h-64 rounded-xl" />
  if (bank.isError) return <Card><ErrorState error={bank.error} onRetry={bank.refetch} /></Card>
  if (!bank.data) return <Card><EmptyState icon={FileQuestion} title="Bank soal tidak ditemukan" description="Bank soal ini tidak ada atau bukan milik Anda." /></Card>
  const b = bank.data
  const all = questions.data ?? []
  const list = type ? all.filter((q) => q.type === type) : all
  const total = all.reduce((n, q) => n + Number(q.points), 0)
  const nextPosition = Math.max(0, ...all.map((q) => q.position)) + 1

  return (
    <div className="space-y-6">
      <Link to="/guru/bank-soal" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Bank Soal
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: b.subject?.color }}>{b.subject?.name}{b.grade ? ` · Kelas ${b.grade}` : ''}</p>
          <h2 className="text-xl font-semibold">{b.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{all.length} soal · total {fmtScore(total)} poin{b.description ? ` · ${b.description}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Dropdown trigger={({ toggle }) => <Button variant="outline" size="icon" onClick={toggle} aria-label="Aksi bank soal"><MoreVertical className="h-4 w-4" /></Button>}>
            <DropdownItem icon={Pencil} onClick={() => setEditBank(true)}>Ubah bank soal</DropdownItem>
            <DropdownItem icon={Trash2} danger onClick={() => setRemoveBank(true)}>Hapus bank soal</DropdownItem>
          </Dropdown>
          <Button icon={Plus} onClick={() => setForm('new')}>Tambah soal</Button>
        </div>
      </div>

      {all.length > 0 && (
        <div className="w-full sm:w-60">
        <FilterSelect value={type} onChange={setType} label="Jenis soal">
          <option value="">Semua jenis</option>
          {Object.entries(QUESTION_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label} ({all.filter((q) => q.type === k).length})</option>)}
        </FilterSelect>
        </div>
      )}

      {questions.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : questions.isError ? (
        <Card><ErrorState error={questions.error} onRetry={questions.refetch} /></Card>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState icon={FileQuestion} title="Bank soal masih kosong" description="Tambahkan soal pilihan ganda, benar/salah, isian singkat, atau esai." action={<Button icon={Plus} onClick={() => setForm('new')}>Tambah soal pertama</Button>} />
        </Card>
      ) : (
        <ol className="space-y-3">
          {list.map((q) => (
            <li key={q.id}>
              <Card className="flex gap-4 p-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{all.indexOf(q) + 1}</span>
                <div className="min-w-0 flex-1 space-y-3">
                  <QuestionMeta question={q} />
                  <QuestionView question={q} />
                </div>
                <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi soal"><MoreVertical className="h-4 w-4" /></Button>}>
                  <DropdownItem icon={Pencil} onClick={() => setForm(q)}>Ubah</DropdownItem>
                  <DropdownItem icon={Copy} onClick={() => run(() => duplicateQuestion(q, nextPosition), 'Soal diduplikasi.').then((ok) => ok && refresh())}>Duplikasi</DropdownItem>
                  <DropdownItem icon={Trash2} danger onClick={() => setRemove(q)}>Hapus</DropdownItem>
                </Dropdown>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {form && (
        <QuestionFormModal
          key={form === 'new' ? 'new' : form.id}
          open
          bankId={bankId}
          question={form === 'new' ? null : form}
          nextPosition={nextPosition}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refresh() }}
        />
      )}
      {editBank && <BankFormModal open bank={b} onClose={() => setEditBank(false)} onSaved={() => { setEditBank(false); refresh() }} />}
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        loading={busy}
        onConfirm={async () => (await run(() => deleteQuestion(remove.id), 'Soal dihapus.')) && (setRemove(null), refresh())}
        title="Hapus soal?"
        confirmLabel="Hapus"
        message="Soal dihapus dari bank soal. Soal yang masih dipakai di kuis tidak dapat dihapus."
      />
      <ConfirmDialog
        open={removeBank}
        onClose={() => setRemoveBank(false)}
        loading={busy}
        onConfirm={async () => {
          if (await run(() => deleteBank(bankId), 'Bank soal dihapus.')) {
            qc.invalidateQueries({ queryKey: qkeys.banks })
            navigate('/guru/bank-soal', { replace: true })
          }
        }}
        title="Hapus bank soal?"
        confirmLabel="Hapus permanen"
        message={`"${b.name}" beserta ${all.length} soalnya akan dihapus. Tidak bisa dihapus bila ada soal yang masih dipakai di kuis.`}
      />
    </div>
  )
}
