import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, EyeOff, FileQuestion, ListOrdered, Lock, Plus, Save, Send, Settings2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Select, Skeleton, Tabs, Textarea } from '@/components/ui'
import { Switch } from '@/components/ui/Input'
import { PublishBadge } from '@/features/classroom/components/status'
import { useCourse } from '@/features/classroom/hooks'
import { fromLocalInput, toLocalInput } from '@/features/tasks/status'
import { toMessage } from '@/lib/errors'
import { deleteQuiz, fetchAttemptCount, fetchQuiz, fetchQuizItems, qkeys, removeQuizItem, updateQuiz, updateQuizItem } from '../api'
import { QuestionMeta, QuestionView } from '../components/QuestionCard'
import { QuestionPickerModal } from '../components/QuestionPickerModal'
import { QuizResultsPanel } from '../components/QuizResultsPanel'
import { KIND_LABEL, REVIEW_MODES, fmtScore } from '../status'

const pick = (q) => ({
  title: q.title,
  kind: q.kind,
  description: q.description ?? '',
  open_at: toLocalInput(q.open_at),
  close_at: toLocalInput(q.close_at),
  duration_minutes: String(q.duration_minutes),
  max_attempts: String(q.max_attempts),
  shuffle_questions: q.shuffle_questions,
  shuffle_options: q.shuffle_options,
  review_mode: q.review_mode,
  show_score: q.show_score,
})

function ItemsTab({ quiz, items, locked, subjectId, onChanged }) {
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const total = items.reduce((n, it) => n + Number(it.points_override ?? it.question.points), 0)

  const run = async (fn) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const move = (idx, dir) =>
    run(async () => {
      const order = [...items]
      ;[order[idx], order[idx + dir]] = [order[idx + dir], order[idx]]
      await Promise.all(order.map((it, i) => (it.position === i ? null : updateQuizItem(it.id, { position: i }))))
    })

  return (
    <div className="space-y-4">
      {locked && (
        <p className="flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> Susunan soal terkunci karena sudah ada siswa yang mengerjakan — agar penilaian adil untuk semua siswa.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{items.length}</span> soal · total <span className="font-semibold text-slate-900">{fmtScore(total)}</span> poin</p>
        {!locked && <Button icon={Plus} onClick={() => setPicker(true)}>Ambil dari bank soal</Button>}
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={FileQuestion} title="Kuis belum berisi soal" description="Ambil soal dari bank soal Anda. Soal dapat diacak per siswa saat dikerjakan." action={<Button icon={Plus} onClick={() => setPicker(true)}>Ambil dari bank soal</Button>} />
        </Card>
      ) : (
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={it.id}>
              <Card className="flex gap-4 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <QuestionMeta question={it.question} points={it.points_override ?? it.question.points} />
                  <QuestionView question={it.question} />
                </div>
                {!locked && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex">
                      <Button variant="ghost" size="icon-sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Naikkan"><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan"><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" disabled={busy} onClick={() => run(() => removeQuizItem(it.id))} aria-label="Keluarkan dari kuis" className="hover:text-red-600"><X className="h-4 w-4" /></Button>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      Skor
                      <input
                        type="number"
                        min={0.5}
                        max={100}
                        step={0.5}
                        defaultValue={Number(it.points_override ?? it.question.points)}
                        onBlur={(e) => {
                          const n = Number(e.target.value)
                          const base = Number(it.question.points)
                          const current = Number(it.points_override ?? base)
                          if (n === current) return
                          if (!(n > 0 && n <= 100)) {
                            e.target.value = current
                            return toast.error('Skor 0,5–100.')
                          }
                          run(() => updateQuizItem(it.id, { points_override: n === base ? null : n }))
                        }}
                        className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-right text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </label>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}
      <QuestionPickerModal
        open={picker}
        quizId={quiz.id}
        subjectId={subjectId}
        existingIds={new Set(items.map((it) => it.question_id))}
        nextPosition={items.length}
        onClose={() => setPicker(false)}
        onAdded={() => {
          setPicker(false)
          onChanged()
        }}
      />
    </div>
  )
}

/** Editor kuis guru: pengaturan, susunan soal, hasil. */
export default function QuizEditorPage() {
  const { taId, quizId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = ['soal', 'hasil'].includes(params.get('tab')) ? params.get('tab') : 'pengaturan'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { course } = useCourse(taId)
  const quiz = useQuery({ queryKey: qkeys.quiz(quizId), queryFn: () => fetchQuiz(quizId) })
  const items = useQuery({ queryKey: qkeys.items(quizId), queryFn: () => fetchQuizItems(quizId) })
  const attempts = useQuery({ queryKey: qkeys.attemptCount(quizId), queryFn: () => fetchAttemptCount(quizId) })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [remove, setRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const basePath = `/guru/kelas/${taId}`

  const original = useMemo(() => (quiz.data ? pick(quiz.data) : null), [quiz.data])
  const values = form ?? original
  const dirty = Boolean(form && original && JSON.stringify(form) !== JSON.stringify(original))
  const set = (k) => (v) => setForm({ ...values, [k]: v })

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const h = (e) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (quiz.isLoading || course.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (quiz.isError) return <Card><ErrorState error={quiz.error} onRetry={quiz.refetch} /></Card>
  if (!quiz.data || !course.data?.can_manage) return <Card><EmptyState icon={EyeOff} title="Kuis tidak ditemukan" description="Kuis ini tidak ada atau Anda tidak dapat mengelolanya." /></Card>

  const q = quiz.data
  const itemList = items.data ?? []
  const locked = (attempts.data ?? 0) > 0
  const refresh = () => {
    quiz.refetch()
    items.refetch()
    attempts.refetch()
    qc.invalidateQueries({ queryKey: qkeys.course(taId) })
  }

  const save = async (extra = {}) => {
    const v = values
    const dur = Number(v.duration_minutes)
    const att = Number(v.max_attempts)
    const problem = !v.title.trim()
      ? 'Judul kuis wajib diisi.'
      : !(dur >= 1 && dur <= 300)
        ? 'Durasi 1–300 menit.'
        : !(att >= 1 && att <= 10)
          ? 'Batas percobaan 1–10 kali.'
          : new Date(v.close_at) <= new Date(v.open_at)
            ? 'Waktu tutup harus setelah waktu buka.'
            : null
    if (problem) {
      toast.error(problem)
      return false
    }
    setSaving(true)
    try {
      await updateQuiz(quizId, {
        title: v.title.trim(),
        kind: v.kind,
        description: v.description.trim() || null,
        open_at: fromLocalInput(v.open_at),
        close_at: fromLocalInput(v.close_at),
        duration_minutes: dur,
        max_attempts: att,
        shuffle_questions: v.shuffle_questions,
        shuffle_options: v.shuffle_options,
        review_mode: v.review_mode,
        show_score: v.show_score,
        ...extra,
      })
      setForm(null)
      refresh()
      return true
    } catch (e) {
      toast.error(toMessage(e))
      return false
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    const publishing = q.status !== 'published'
    if (publishing && itemList.length === 0) return toast.error('Tambahkan minimal satu soal sebelum menerbitkan.')
    if (publishing && new Date(values.close_at) <= new Date()) return toast.error('Waktu tutup sudah lewat. Atur ulang jadwal kuis.')
    if (await save({ status: publishing ? 'published' : 'draft' })) {
      toast.success(publishing ? 'Kuis diterbitkan — siswa dapat mengerjakannya sesuai jadwal.' : 'Kuis ditarik menjadi draf. Siswa tidak lagi melihatnya.')
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await deleteQuiz(quizId)
      toast.success('Kuis dihapus.')
      setForm(null)
      qc.invalidateQueries({ queryKey: qkeys.all })
      navigate(`${basePath}?tab=kuis`, { replace: true })
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link to={`${basePath}?tab=kuis`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {course.data.subject_name} · {course.data.class_name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PublishBadge status={q.status} />
          {dirty && <span className="text-xs font-medium text-accent-600">Ada perubahan belum disimpan</span>}
          {tab === 'pengaturan' && <Button variant="outline" icon={Save} disabled={!dirty} loading={saving} onClick={async () => (await save()) && toast.success('Pengaturan kuis disimpan.')}>Simpan</Button>}
          <Button variant={q.status === 'published' ? 'secondary' : 'success'} icon={q.status === 'published' ? EyeOff : Send} loading={saving} onClick={togglePublish}>
            {q.status === 'published' ? 'Tarik ke draf' : 'Terbitkan'}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-violet-600">{KIND_LABEL[q.kind]}</p>
        <h2 className="text-xl font-semibold">{q.title}</h2>
        <Tabs
          className="mt-3 inline-flex"
          value={tab}
          onChange={(v) => setParams(v === 'pengaturan' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'pengaturan', label: 'Pengaturan', icon: Settings2 },
            { value: 'soal', label: 'Soal', icon: ListOrdered, count: itemList.length },
            { value: 'hasil', label: 'Hasil & Penilaian', icon: BarChart3 },
          ]}
        />
      </div>

      {tab === 'soal' ? (
        items.isLoading ? <Skeleton className="h-64 rounded-xl" /> : items.isError ? <Card><ErrorState error={items.error} onRetry={items.refetch} /></Card> : (
          <ItemsTab quiz={q} items={itemList} locked={locked} subjectId={course.data.subject_id} onChanged={refresh} />
        )
      ) : tab === 'hasil' ? (
        q.status === 'published' || locked ? <QuizResultsPanel quiz={q} canManage /> : <Card><EmptyState icon={BarChart3} title="Kuis belum terbit" description="Hasil siswa muncul di sini setelah kuis diterbitkan dan dikerjakan." /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <Input label="Judul" required value={values.title} onChange={(e) => set('title')(e.target.value)} />
                <Select label="Jenis" value={values.kind} onChange={(e) => set('kind')(e.target.value)}>
                  <option value="quiz">Kuis</option>
                  <option value="exam">Ujian</option>
                </Select>
              </div>
              <Textarea label="Petunjuk pengerjaan" rows={3} value={values.description} onChange={(e) => set('description')(e.target.value)} placeholder="Contoh: Kerjakan dengan jujur. Pastikan baterai HP cukup." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Dibuka" type="datetime-local" value={values.open_at} onChange={(e) => set('open_at')(e.target.value)} />
                <Input label="Ditutup" type="datetime-local" value={values.close_at} onChange={(e) => set('close_at')(e.target.value)} />
                <Input label="Durasi pengerjaan (menit)" type="number" min={1} max={300} value={values.duration_minutes} onChange={(e) => set('duration_minutes')(e.target.value)} hint="Dihitung server sejak siswa menekan Mulai." />
                <Input label="Batas percobaan" type="number" min={1} max={10} value={values.max_attempts} onChange={(e) => set('max_attempts')(e.target.value)} hint="Nilai yang dipakai: nilai tertinggi." />
              </div>
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader icon={Settings2} title="Keamanan & tampilan" />
              <CardBody className="space-y-4">
                <Switch checked={values.shuffle_questions} onChange={set('shuffle_questions')} label="Acak urutan soal" description="Setiap siswa mendapat urutan berbeda." />
                <Switch checked={values.shuffle_options} onChange={set('shuffle_options')} label="Acak urutan pilihan jawaban" />
                <Switch checked={values.show_score} onChange={set('show_score')} label="Tampilkan nilai ke siswa" description="Bila dimatikan, siswa hanya melihat bahwa jawabannya terkumpul." />
                <Select label="Kunci jawaban & pembahasan" value={values.review_mode} onChange={(e) => set('review_mode')(e.target.value)} hint="Kunci jawaban tidak pernah dikirim ke HP siswa sebelum diizinkan.">
                  {REVIEW_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Button variant="ghost" size="sm" icon={Trash2} className="-ml-2 text-red-600 hover:bg-red-50" onClick={() => setRemove(true)}>Hapus kuis</Button>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={remove}
        onClose={() => setRemove(false)}
        loading={busy}
        onConfirm={doDelete}
        title="Hapus kuis?"
        confirmLabel="Hapus permanen"
        message={locked ? `Sudah ada ${attempts.data} percobaan siswa. Kuis, seluruh jawaban, dan nilainya akan dihapus permanen. Soal di bank soal tetap aman.` : 'Kuis akan dihapus. Soal di bank soal tetap aman.'}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Tinggalkan tanpa menyimpan?"
        confirmLabel="Tinggalkan"
        message="Perubahan pengaturan kuis belum disimpan dan akan hilang."
      />
    </div>
  )
}
