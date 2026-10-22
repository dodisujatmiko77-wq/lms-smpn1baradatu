import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CloudOff, Flag, Grid3x3, Loader2, Send, Timer, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, ConfirmDialog, ErrorState, Modal } from '@/components/ui'
import { SchoolLogo } from '@/components/layout/SchoolLogo'
import { toMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { fetchAttempt, qkeys, reportFocusLost, saveAnswer, submitAttempt } from '../api'
import { QuestionTypeBadge, fmtScore, formatClock } from '../status'

const TEXT_DEBOUNCE = 800
const RETRY_DELAY = 3000

const readFlags = (id) => {
  try {
    return JSON.parse(localStorage.getItem(`quiz-flags-${id}`) ?? '[]')
  } catch {
    return []
  }
}
const writeFlags = (id, flags) => {
  try {
    localStorage.setItem(`quiz-flags-${id}`, JSON.stringify(flags))
  } catch {
    // Penyimpanan lokal tidak tersedia (mode privat) — tanda ragu-ragu hanya bertahan selama halaman terbuka.
  }
}

const isAnswered = (a) => Boolean(a && (a.option_id || (a.text ?? '').trim()))
// Pesan server yang berarti percobaan sudah ditutup (waktu habis / sudah dikumpulkan).
const isClosedError = (e) => /waktu pengerjaan sudah habis|sudah dikumpulkan/i.test(e?.message ?? '')

function Navigator({ questions, answers, flags, current, onPick }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((q, i) => {
        const answered = isAnswered(answers[q.id])
        const flagged = flags.includes(q.id)
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Soal ${i + 1}${answered ? ', sudah dijawab' : ''}${flagged ? ', ragu-ragu' : ''}`}
            aria-current={i === current}
            className={cn(
              'relative grid h-11 place-items-center rounded-lg border text-sm font-semibold transition',
              flagged ? 'border-accent-400 bg-accent-100 text-accent-800' : answered ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              i === current && 'ring-2 ring-primary-500 ring-offset-2',
            )}
          >
            {i + 1}
            {flagged && answered && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-600" />}
          </button>
        )
      })}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary-600" /> Dijawab</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-accent-400 bg-accent-100" /> Ragu-ragu</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-300 bg-white" /> Belum</span>
    </div>
  )
}

function QuestionInput({ question, answer, onChoose, onText }) {
  const q = question
  if (q.type === 'mcq' || q.type === 'true_false') {
    const options = q.type === 'mcq' ? q.options : [{ id: 'true', body: 'Benar' }, { id: 'false', body: 'Salah' }]
    const selected = q.type === 'mcq' ? answer?.option_id : answer?.text
    return (
      <div className={cn('gap-3', q.type === 'true_false' ? 'grid grid-cols-2' : 'space-y-3')} role="radiogroup">
        {options.map((o, i) => {
          const on = selected === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChoose(o.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left text-[15px] transition active:scale-[0.99]',
                on ? 'border-primary-600 bg-primary-50 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}
            >
              {q.type === 'mcq' && (
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold', on ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600')}>
                  {String.fromCharCode(65 + i)}
                </span>
              )}
              <span className={cn('min-w-0 flex-1 whitespace-pre-line pt-0.5', q.type === 'true_false' && 'text-center font-semibold')}>{o.body}</span>
            </button>
          )
        })}
      </div>
    )
  }
  if (q.type === 'short') {
    return (
      <input
        value={answer?.text ?? ''}
        onChange={(e) => onText(e.target.value)}
        maxLength={500}
        placeholder="Ketik jawaban singkat…"
        aria-label="Jawaban"
        autoComplete="off"
        className="h-12 w-full rounded-xl border-2 border-slate-200 px-4 text-[15px] focus:border-primary-500 focus:outline-none"
      />
    )
  }
  return (
    <div className="space-y-1">
      <textarea
        value={answer?.text ?? ''}
        onChange={(e) => onText(e.target.value)}
        maxLength={10000}
        rows={8}
        placeholder="Tulis jawaban uraianmu…"
        aria-label="Jawaban"
        className="w-full rounded-xl border-2 border-slate-200 p-4 text-[15px] focus:border-primary-500 focus:outline-none"
      />
      <p className="text-right text-xs text-slate-500">{(answer?.text ?? '').length} karakter</p>
    </div>
  )
}

/** Halaman mengerjakan kuis (mode fokus, tanpa menu). */
export default function QuizTakePage() {
  const { quizId, attemptId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const attempt = useQuery({
    queryKey: qkeys.attempt(attemptId),
    queryFn: () => fetchAttempt(attemptId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const [local, setLocal] = useState({}) // jawaban yang diubah di perangkat ini
  const [flags, setFlags] = useState(() => readFlags(attemptId))
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(new Map()) // questionId → { optionId, text }
  const timers = useRef(new Map())
  const flushing = useRef(false)
  const retryTimer = useRef(null)
  const autoSubmitted = useRef(false)
  const warned = useRef(new Set())
  const finished = useRef(false) // dibaca saat navigasi; state akan terlambat satu render

  const data = attempt.data
  const questions = data?.questions ?? []
  const serverAnswers = Object.fromEntries(questions.map((q) => [q.id, q.answer ?? null]))
  const answers = { ...serverAnswers, ...local }

  const goToResult = useCallback(
    (message) => {
      finished.current = true
      qc.invalidateQueries({ queryKey: qkeys.mine })
      qc.invalidateQueries({ queryKey: qkeys.myAttempts(quizId) })
      if (message) toast.info(message)
      navigate(`/siswa/kuis/${quizId}/hasil/${attemptId}`, { replace: true })
    },
    [attemptId, navigate, qc, quizId],
  )

  // Kirim semua jawaban tertunda; gagal jaringan → coba lagi otomatis.
  const flush = useCallback(async () => {
    if (flushing.current) return pending.current.size === 0
    flushing.current = true
    clearTimeout(retryTimer.current)
    try {
      while (pending.current.size) {
        const [qid, payload] = pending.current.entries().next().value
        setSaveState('saving')
        try {
          await saveAnswer(attemptId, qid, payload)
          if (pending.current.get(qid) === payload) pending.current.delete(qid)
        } catch (e) {
          if (isClosedError(e)) {
            pending.current.clear()
            goToResult('Waktu pengerjaan sudah habis. Jawaban yang tersimpan telah dikumpulkan.')
            return false
          }
          setSaveState('error')
          retryTimer.current = setTimeout(flush, RETRY_DELAY)
          return false
        }
      }
      setSaveState('saved')
      return true
    } finally {
      flushing.current = false
    }
  }, [attemptId, goToResult])

  const queue = (qid, payload, delay = 0) => {
    pending.current.set(qid, payload)
    clearTimeout(timers.current.get(qid))
    if (delay) timers.current.set(qid, setTimeout(flush, delay))
    else flush()
  }

  const choose = (q, value) => {
    const payload = q.type === 'mcq' ? { optionId: value, text: null } : { optionId: null, text: value }
    setLocal((s) => ({ ...s, [q.id]: { option_id: payload.optionId, text: payload.text } }))
    queue(q.id, payload)
  }
  const typeText = (q, text) => {
    setLocal((s) => ({ ...s, [q.id]: { option_id: null, text } }))
    queue(q.id, { optionId: null, text }, TEXT_DEBOUNCE)
  }
  const toggleFlag = (qid) =>
    setFlags((f) => {
      const next = f.includes(qid) ? f.filter((x) => x !== qid) : [...f, qid]
      writeFlags(attemptId, next)
      return next
    })

  const submit = useCallback(
    async (auto = false) => {
      setSubmitting(true)
      for (const t of timers.current.values()) clearTimeout(t)
      await flush()
      try {
        await submitAttempt(attemptId)
        try {
          localStorage.removeItem(`quiz-flags-${attemptId}`)
        } catch {
          // abaikan
        }
        goToResult(auto ? 'Waktu habis — jawabanmu dikumpulkan otomatis.' : 'Jawaban berhasil dikumpulkan.')
      } catch (e) {
        setSubmitting(false)
        setConfirmSubmit(false)
        toast.error(`${toMessage(e)} Coba tekan Kumpulkan lagi.`)
      }
    },
    [attemptId, flush, goToResult],
  )

  // Percobaan sudah ditutup (dibuka ulang setelah selesai) → langsung ke hasil.
  useEffect(() => {
    if (data && data.status !== 'in_progress') goToResult()
  }, [data, goToResult])

  // Timer mengikuti jam server (offset dihitung saat soal dimuat).
  useEffect(() => {
    if (!data || data.status !== 'in_progress') return
    const deadline = new Date(data.deadline_at).getTime()
    const tick = () => {
      const left = deadline - (Date.now() + data.offset)
      setRemaining(left)
      for (const min of [5, 1]) {
        if (left <= min * 60_000 && left > (min * 60 - 5) * 1000 && !warned.current.has(min)) {
          warned.current.add(min)
          toast.warning(`Sisa waktu ${min} menit. Periksa kembali jawabanmu.`)
        }
      }
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true
        submit(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [data, submit])

  // Catat saat siswa meninggalkan halaman ujian.
  useEffect(() => {
    if (!data || data.status !== 'in_progress') return
    let leftAt = null
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        leftAt = Date.now()
        reportFocusLost(attemptId).catch(() => {})
        flush()
      } else if (leftAt) {
        leftAt = null
        toast.warning('Kamu meninggalkan halaman ujian. Kejadian ini dicatat dan dapat dilihat guru.')
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [attemptId, data, flush])

  useEffect(() => {
    const h = (e) => {
      if (!finished.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  useEffect(() => {
    const t = timers.current
    return () => {
      for (const x of t.values()) clearTimeout(x)
      clearTimeout(retryTimer.current)
    }
  }, [])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => !finished.current && currentLocation.pathname !== nextLocation.pathname)

  if (attempt.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-sm text-slate-500"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /> Menyiapkan soal…</div>
      </div>
    )
  }
  if (attempt.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white shadow-card">
          <ErrorState error={attempt.error} onRetry={attempt.refetch} title="Soal gagal dimuat" />
          <div className="border-t border-slate-100 p-4 text-center">
            <Button variant="ghost" onClick={() => navigate(`/siswa/kuis/${quizId}`)}>Kembali</Button>
          </div>
        </div>
      </div>
    )
  }
  if (!data || data.status !== 'in_progress') return null

  const q = questions[current]
  const answeredCount = questions.filter((x) => isAnswered(answers[x.id])).length
  const unanswered = questions.length - answeredCount
  const low = remaining != null && remaining <= 5 * 60_000

  return (
    <div className="min-h-dvh bg-slate-50 pb-28 lg:pb-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <SchoolLogo className="hidden h-9 w-9 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{data.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {saveState === 'saving' ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Menyimpan…</>
              ) : saveState === 'error' ? (
                <span className="flex items-center gap-1 font-medium text-red-600"><CloudOff className="h-3 w-3" /> Belum tersimpan — mencoba lagi</span>
              ) : saveState === 'saved' ? (
                <><CheckCircle2 className="h-3 w-3 text-success-600" /> Jawaban tersimpan</>
              ) : (
                <>{answeredCount}/{questions.length} dijawab</>
              )}
            </p>
          </div>
          <div
            className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-base font-semibold tabular-nums', low ? 'animate-pulse bg-red-50 text-red-700' : 'bg-primary-50 text-primary-700')}
            role="timer"
            aria-label="Sisa waktu"
          >
            <Timer className="h-4 w-4" /> {remaining == null ? '--:--' : formatClock(remaining)}
          </div>
          <div className="hidden sm:block">
            <Button icon={Send} onClick={() => setConfirmSubmit(true)} disabled={submitting}>Kumpulkan</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[1fr_300px]">
        <main className="space-y-5">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-500">Soal {current + 1} dari {questions.length}</span>
              <div className="flex items-center gap-2">
                <QuestionTypeBadge type={q.type} />
                <span className="text-xs text-slate-500">{fmtScore(q.points)} poin</span>
              </div>
            </div>
            <p className="mb-5 whitespace-pre-line text-[17px] leading-relaxed text-slate-900">{q.body}</p>
            <QuestionInput key={q.id} question={q} answer={answers[q.id]} onChoose={(v) => choose(q, v)} onText={(t) => typeText(q, t)} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" icon={ArrowLeft} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)} aria-label="Soal sebelumnya">
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            <Button
              variant="outline"
              icon={Flag}
              onClick={() => toggleFlag(q.id)}
              className={cn(flags.includes(q.id) && 'border-accent-400 bg-accent-50 text-accent-800 hover:bg-accent-100')}
              aria-pressed={flags.includes(q.id)}
            >
              Ragu-ragu
            </Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)} aria-label="Soal berikutnya">
                <span className="hidden sm:inline">Berikutnya</span> <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="success" icon={Send} onClick={() => setConfirmSubmit(true)} disabled={submitting}>Selesai</Button>
            )}
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-slate-900">Nomor soal</p>
            <Navigator questions={questions} answers={answers} flags={flags} current={current} onPick={setCurrent} />
            <Legend />
            <Button className="w-full" icon={Send} onClick={() => setConfirmSubmit(true)} disabled={submitting}>Kumpulkan jawaban</Button>
          </div>
        </aside>
      </div>

      {/* Bilah bawah untuk HP */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white p-3 lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Button variant="outline" icon={Grid3x3} className="flex-1" onClick={() => setNavOpen(true)}>Daftar soal ({answeredCount}/{questions.length})</Button>
        <Button icon={Send} className="flex-1" onClick={() => setConfirmSubmit(true)} disabled={submitting}>Kumpulkan</Button>
      </div>

      <Modal open={navOpen} onClose={() => setNavOpen(false)} title="Daftar soal" description={`${answeredCount} dari ${questions.length} soal dijawab`}>
        <div className="space-y-4">
          <Navigator questions={questions} answers={answers} flags={flags} current={current} onPick={(i) => { setCurrent(i); setNavOpen(false) }} />
          <Legend />
        </div>
      </Modal>

      <Modal
        open={confirmSubmit}
        onClose={() => !submitting && setConfirmSubmit(false)}
        dismissible={!submitting}
        size="sm"
        title="Kumpulkan jawaban?"
        footer={
          <>
            <Button variant="outline" icon={X} disabled={submitting} onClick={() => setConfirmSubmit(false)}>Periksa lagi</Button>
            <Button icon={Send} loading={submitting} onClick={() => submit(false)}>Ya, kumpulkan</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-primary-50 p-3"><p className="font-display text-2xl font-semibold text-primary-700">{answeredCount}</p><p className="text-xs">dijawab</p></div>
            <div className="rounded-xl bg-slate-100 p-3"><p className="font-display text-2xl font-semibold text-slate-700">{unanswered}</p><p className="text-xs">kosong</p></div>
            <div className="rounded-xl bg-accent-50 p-3"><p className="font-display text-2xl font-semibold text-accent-700">{flags.length}</p><p className="text-xs">ragu-ragu</p></div>
          </div>
          {unanswered > 0 && <p className="flex gap-2 text-accent-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Masih ada {unanswered} soal yang belum dijawab.</p>}
          <p>Setelah dikumpulkan, jawaban tidak dapat diubah.</p>
          {saveState === 'error' && <p className="font-medium text-red-600">Beberapa jawaban belum tersimpan. Sistem akan mencoba mengirimnya saat kamu menekan Kumpulkan.</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => {
          flush()
          blocker.proceed?.()
        }}
        title="Keluar dari halaman ujian?"
        confirmLabel="Keluar"
        message="Waktu tetap berjalan walau kamu keluar. Jawaban yang sudah tersimpan aman; kamu bisa melanjutkan dari menu Kuis selama waktu masih ada."
      />
    </div>
  )
}
