import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckSquare, FileQuestion, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button, EmptyState, FilterSelect, Modal, SkeletonRows } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { addQuizItems, fetchBanks, fetchQuestions, qkeys } from '../api'
import { QuestionMeta, QuestionView } from './QuestionCard'

/** Memilih soal dari bank soal untuk dimasukkan ke kuis. */
export function QuestionPickerModal({ open, quizId, subjectId, existingIds, nextPosition, onClose, onAdded }) {
  const banks = useQuery({ queryKey: qkeys.banks, queryFn: fetchBanks, enabled: open })
  const [bankId, setBankId] = useState('')
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)
  const bankList = [...(banks.data ?? [])].sort((a, b) => Number(b.subject_id === subjectId) - Number(a.subject_id === subjectId))
  const activeBank = bankId || bankList[0]?.id || ''
  const questions = useQuery({ queryKey: qkeys.questions(activeBank), queryFn: () => fetchQuestions(activeBank), enabled: open && Boolean(activeBank) })
  const available = (questions.data ?? []).filter((q) => !existingIds.has(q.id))
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const allPicked = available.length > 0 && available.every((q) => picked.includes(q.id))

  const add = async () => {
    setSaving(true)
    try {
      await addQuizItems(quizId, picked, nextPosition)
      toast.success(`${picked.length} soal ditambahkan ke kuis.`)
      setPicked([])
      onAdded()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Ambil soal dari bank soal"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          <Button disabled={!picked.length} loading={saving} onClick={add}>Tambahkan {picked.length || ''} soal</Button>
        </>
      }
    >
      {banks.isLoading ? (
        <SkeletonRows rows={4} />
      ) : bankList.length === 0 ? (
        <EmptyState icon={FileQuestion} title="Belum ada bank soal" description="Buat bank soal dan isi soalnya terlebih dahulu." action={<Link to="/guru/bank-soal"><Button>Buka Bank Soal</Button></Link>} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={activeBank} onChange={(v) => setBankId(v)} label="Bank soal" className="min-w-0 flex-1">
              {bankList.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.subject?.name} ({b.question_count})</option>)}
            </FilterSelect>
            {available.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setPicked((p) => (allPicked ? p.filter((id) => !available.some((q) => q.id === id)) : [...new Set([...p, ...available.map((q) => q.id)])]))}>
                {allPicked ? 'Batal pilih semua' : 'Pilih semua'}
              </Button>
            )}
          </div>
          {questions.isLoading ? (
            <SkeletonRows rows={4} />
          ) : available.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{(questions.data ?? []).length ? 'Semua soal di bank ini sudah ada di kuis.' : 'Bank soal ini belum berisi soal.'}</p>
          ) : (
            <ul className="space-y-2">
              {available.map((q) => {
                const on = picked.includes(q.id)
                return (
                  <li key={q.id}>
                    <button type="button" onClick={() => toggle(q.id)} aria-pressed={on} className={cn('flex w-full gap-3 rounded-xl border p-3 text-left transition', on ? 'border-primary-400 bg-primary-50/60' : 'border-slate-200 hover:border-slate-300')}>
                      {on ? <CheckSquare className="h-5 w-5 shrink-0 text-primary-600" /> : <Square className="h-5 w-5 shrink-0 text-slate-300" />}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <QuestionMeta question={q} />
                        <QuestionView question={q} compact />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
