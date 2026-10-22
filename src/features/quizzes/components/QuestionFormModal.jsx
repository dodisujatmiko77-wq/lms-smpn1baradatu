import { useState } from 'react'
import { CheckCircle2, Circle, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { saveQuestion } from '../api'
import { QUESTION_TYPES } from '../status'

const blankOptions = () => [0, 1, 2, 3].map(() => ({ body: '', is_correct: false }))

function initial(q) {
  if (!q) return { type: 'mcq', body: '', answer_key: '', explanation: '', points: '1', options: blankOptions() }
  return {
    type: q.type,
    body: q.body,
    answer_key: q.answer_key ?? '',
    explanation: q.explanation ?? '',
    points: String(Number(q.points)),
    options: q.type === 'mcq' ? q.options.map(({ id, body, is_correct }) => ({ id, body, is_correct })) : blankOptions(),
  }
}

/** Tambah / ubah satu soal di bank soal. `question` null = soal baru. */
export function QuestionFormModal({ open, bankId, question, nextPosition, onClose, onSaved }) {
  const [v, setV] = useState(() => initial(question))
  const [saving, setSaving] = useState(false)
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }))
  const setOption = (i, patch) => setV((s) => ({ ...s, options: s.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }))
  const markCorrect = (i) => setV((s) => ({ ...s, options: s.options.map((o, j) => ({ ...o, is_correct: j === i })) }))

  const validate = () => {
    const pts = Number(v.points)
    if (!v.body.trim()) return 'Pertanyaan wajib diisi.'
    if (!(pts > 0 && pts <= 100)) return 'Skor soal harus lebih dari 0 dan maksimal 100.'
    if (v.type === 'mcq') {
      const filled = v.options.filter((o) => o.body.trim())
      if (filled.length < 2) return 'Isi minimal dua pilihan jawaban.'
      if (!filled.some((o) => o.is_correct)) return 'Tandai satu pilihan sebagai jawaban benar.'
    }
    if (v.type === 'true_false' && !['true', 'false'].includes(v.answer_key)) return 'Pilih kunci jawaban: Benar atau Salah.'
    if (v.type === 'short' && !v.answer_key.trim()) return 'Isi minimal satu kunci jawaban isian.'
    return null
  }

  const submit = async (e) => {
    e.preventDefault()
    const problem = validate()
    if (problem) return toast.error(problem)
    setSaving(true)
    try {
      await saveQuestion(
        {
          id: question?.id,
          bank_id: bankId,
          type: v.type,
          body: v.body.trim(),
          answer_key: v.type === 'mcq' ? null : v.answer_key.trim() || null,
          explanation: v.explanation.trim() || null,
          points: Number(v.points),
          ...(question ? {} : { position: nextPosition }),
        },
        v.options.filter((o) => o.body.trim()).map((o) => ({ ...o, body: o.body.trim() })),
      )
      toast.success(question ? 'Soal diperbarui.' : 'Soal ditambahkan ke bank soal.')
      onSaved()
    } catch (err) {
      toast.error(toMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={question ? 'Ubah soal' : 'Tambah soal'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" form="question-form" loading={saving}>Simpan soal</Button>
        </>
      }
    >
      <form id="question-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">Jenis soal</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(QUESTION_TYPES).map(([value, t]) => (
              <button
                key={value}
                type="button"
                disabled={Boolean(question)}
                onClick={() => set('type')(value)}
                aria-pressed={v.type === value}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed',
                  v.type === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50',
                )}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            ))}
          </div>
          {question && <p className="text-xs text-slate-500">Jenis soal tidak dapat diubah setelah dibuat.</p>}
        </div>

        <Textarea label="Pertanyaan" required rows={4} value={v.body} onChange={(e) => set('body')(e.target.value)} placeholder="Tuliskan pertanyaan…" />

        {v.type === 'mcq' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Pilihan jawaban <span className="font-normal text-slate-500">— klik lingkaran untuk menandai jawaban benar</span></p>
            {v.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button type="button" onClick={() => markCorrect(i)} aria-label={`Tandai pilihan ${String.fromCharCode(65 + i)} benar`} className={cn('shrink-0 rounded-full', o.is_correct ? 'text-success-600' : 'text-slate-300 hover:text-slate-400')}>
                  {o.is_correct ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                </button>
                <span className="w-5 text-sm font-semibold text-slate-500">{String.fromCharCode(65 + i)}.</span>
                <input
                  value={o.body}
                  onChange={(e) => setOption(i, { body: e.target.value })}
                  placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                  className={cn('h-10 flex-1 rounded-[10px] border px-3 text-sm focus:outline-none focus:ring-4', o.is_correct ? 'border-success-300 bg-success-50/50 focus:ring-success-500/10' : 'border-slate-200 focus:border-primary-500 focus:ring-primary-500/10')}
                />
                {v.options.length > 2 && (
                  <button type="button" onClick={() => setV((s) => ({ ...s, options: s.options.filter((_, j) => j !== i) }))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label="Hapus pilihan">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {v.options.length < 6 && (
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setV((s) => ({ ...s, options: [...s.options, { body: '', is_correct: false }] }))}>Tambah pilihan</Button>
            )}
          </div>
        )}

        {v.type === 'true_false' && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Kunci jawaban</p>
            <div className="flex gap-2">
              {[['true', 'Benar'], ['false', 'Salah']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => set('answer_key')(val)} aria-pressed={v.answer_key === val}
                  className={cn('flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition', v.answer_key === val ? 'border-success-500 bg-success-50 text-success-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {v.type === 'short' && (
          <Textarea
            label="Kunci jawaban"
            required
            rows={3}
            value={v.answer_key}
            onChange={(e) => set('answer_key')(e.target.value)}
            placeholder={'-9\nnegatif 9'}
            hint="Satu jawaban yang diterima per baris. Penilaian tidak membedakan huruf besar/kecil dan spasi berlebih."
          />
        )}

        {v.type === 'essay' && (
          <Textarea label="Pedoman penilaian (hanya untuk guru)" rows={3} value={v.answer_key} onChange={(e) => set('answer_key')(e.target.value)} placeholder="Poin-poin yang harus ada dalam jawaban…" hint="Soal esai dinilai manual oleh guru setelah siswa mengumpulkan." />
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Textarea label="Pembahasan (opsional)" rows={2} value={v.explanation} onChange={(e) => set('explanation')(e.target.value)} placeholder="Ditampilkan ke siswa bila pembahasan diizinkan" />
          <Input label="Skor" type="number" min={0.5} max={100} step={0.5} value={v.points} onChange={(e) => set('points')(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}
