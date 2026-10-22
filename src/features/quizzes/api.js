import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/db'

export const qkeys = {
  all: ['quizzes'],
  banks: ['quizzes', 'banks'],
  bank: (id) => ['quizzes', 'bank', id],
  questions: (bankId) => ['quizzes', 'questions', bankId],
  course: (taId) => ['quizzes', 'course', taId],
  quiz: (id) => ['quizzes', 'quiz', id],
  items: (id) => ['quizzes', 'items', id],
  results: (id) => ['quizzes', 'results', id],
  attemptCount: (id) => ['quizzes', 'attempt-count', id],
  attemptDetail: (id) => ['quizzes', 'attempt-detail', id],
  queue: ['quizzes', 'queue'],
  mine: ['quizzes', 'mine'],
  myAttempts: (quizId) => ['quizzes', 'my-attempts', quizId],
  attempt: (id) => ['quizzes', 'attempt', id],
  result: (id) => ['quizzes', 'result', id],
}

const QUESTION_SELECT = 'id, bank_id, type, body, answer_key, explanation, points, position, updated_at, options:quiz_options(id, body, is_correct, position)'
const sortOptions = (q) => ({ ...q, options: [...(q.options ?? [])].sort((a, b) => a.position - b.position) })

// ---------- Bank soal (guru) ----------
export async function fetchBanks() {
  const rows = unwrap(
    await supabase
      .from('question_banks')
      .select('id, name, description, grade, subject_id, teacher_id, updated_at, subject:subjects(name, code, color), questions:quiz_questions(count)')
      .order('updated_at', { ascending: false }),
  )
  return rows.map((b) => ({ ...b, question_count: b.questions?.[0]?.count ?? 0 }))
}

export const fetchBank = async (id) =>
  unwrap(await supabase.from('question_banks').select('*, subject:subjects(name, code, color)').eq('id', id).maybeSingle())

export const createBank = async (row) => unwrap(await supabase.from('question_banks').insert(row).select('id').single())
export const updateBank = async (id, patch) => unwrap(await supabase.from('question_banks').update(patch).eq('id', id))
export const deleteBank = async (id) => unwrap(await supabase.from('question_banks').delete().eq('id', id))

export async function fetchQuestions(bankId) {
  const rows = unwrap(await supabase.from('quiz_questions').select(QUESTION_SELECT).eq('bank_id', bankId).order('position').order('created_at'))
  return rows.map(sortOptions)
}

/**
 * Simpan soal beserta opsinya. Opsi lama diperbarui (id tetap) agar jawaban
 * siswa yang merujuk ke opsi tidak hilang; opsi yang dibuang dihapus.
 */
export async function saveQuestion(question, options = []) {
  const { id, ...fields } = question
  let qid = id
  if (id) unwrap(await supabase.from('quiz_questions').update(fields).eq('id', id))
  else qid = unwrap(await supabase.from('quiz_questions').insert(fields).select('id').single()).id

  if (fields.type !== 'mcq') {
    if (id) unwrap(await supabase.from('quiz_options').delete().eq('question_id', qid))
    return qid
  }
  const existing = id ? unwrap(await supabase.from('quiz_options').select('id').eq('question_id', qid)) : []
  const keep = new Set(options.filter((o) => o.id).map((o) => o.id))
  const removed = existing.filter((o) => !keep.has(o.id)).map((o) => o.id)
  if (removed.length) unwrap(await supabase.from('quiz_options').delete().in('id', removed))
  for (const [i, o] of options.entries()) {
    const row = { body: o.body, is_correct: o.is_correct, position: i }
    if (o.id) unwrap(await supabase.from('quiz_options').update(row).eq('id', o.id))
    else unwrap(await supabase.from('quiz_options').insert({ ...row, question_id: qid }))
  }
  return qid
}

export const deleteQuestion = async (id) => unwrap(await supabase.from('quiz_questions').delete().eq('id', id))

export async function duplicateQuestion(q, position) {
  const { id: _id, options, updated_at: _u, ...fields } = q
  return saveQuestion({ ...fields, position }, options.map(({ body, is_correct }) => ({ body, is_correct })))
}

// ---------- Kuis (guru) ----------
export const fetchCourseQuizzes = async (taId) => unwrap(await supabase.rpc('get_course_quizzes', { p_ta_id: taId }))
export const fetchQuiz = async (id) => unwrap(await supabase.from('quizzes').select('*').eq('id', id).maybeSingle())
export const createQuiz = async (row) => unwrap(await supabase.from('quizzes').insert(row).select('id').single())
export const updateQuiz = async (id, patch) => unwrap(await supabase.from('quizzes').update(patch).eq('id', id).select().single())
export const deleteQuiz = async (id) => unwrap(await supabase.from('quizzes').delete().eq('id', id))

export async function fetchQuizItems(quizId) {
  const rows = unwrap(
    await supabase
      .from('quiz_question_items')
      .select(`id, position, points_override, question_id, question:quiz_questions(${QUESTION_SELECT})`)
      .eq('quiz_id', quizId)
      .order('position'),
  )
  return rows.map((r) => ({ ...r, question: sortOptions(r.question) }))
}

export async function addQuizItems(quizId, questionIds, startPosition) {
  if (!questionIds.length) return
  unwrap(await supabase.from('quiz_question_items').insert(questionIds.map((qid, i) => ({ quiz_id: quizId, question_id: qid, position: startPosition + i }))))
}

export const updateQuizItem = async (id, patch) => unwrap(await supabase.from('quiz_question_items').update(patch).eq('id', id))
export const removeQuizItem = async (id) => unwrap(await supabase.from('quiz_question_items').delete().eq('id', id))

export const fetchQuizResults = async (quizId) => unwrap(await supabase.rpc('get_quiz_results', { p_quiz_id: quizId }))
export const fetchAttemptDetail = async (id) => unwrap(await supabase.rpc('get_attempt_detail', { p_attempt_id: id }))
export const gradeEssay = async (attemptId, questionId, score) =>
  unwrap(await supabase.rpc('grade_essay', { p_attempt_id: attemptId, p_question_id: questionId, p_score: score }))
export const resetAttempt = async (id) => unwrap(await supabase.rpc('reset_quiz_attempt', { p_attempt_id: id }))
export const fetchQuizGradingQueue = async () => unwrap(await supabase.rpc('get_quiz_grading_queue'))

// ---------- Siswa ----------
export const fetchMyQuizzes = async () => unwrap(await supabase.rpc('get_my_quizzes'))
export const fetchMyAttempts = async (quizId) => unwrap(await supabase.rpc('get_my_quiz_attempts', { p_quiz_id: quizId }))
export const startAttempt = async (quizId) => unwrap(await supabase.rpc('start_quiz_attempt', { p_quiz_id: quizId }))
export const submitAttempt = async (id) => unwrap(await supabase.rpc('submit_quiz_attempt', { p_attempt_id: id }))
export const reportFocusLost = async (id) => unwrap(await supabase.rpc('report_focus_lost', { p_attempt_id: id }))
export const fetchAttemptResult = async (id) => unwrap(await supabase.rpc('get_attempt_result', { p_attempt_id: id }))

/** Soal percobaan + selisih jam perangkat terhadap jam server (ms). */
export async function fetchAttempt(id) {
  const sent = Date.now()
  const data = unwrap(await supabase.rpc('get_attempt', { p_attempt_id: id }))
  const received = Date.now()
  // Perkiraan waktu server saat respons diterima = server_now + setengah waktu tempuh.
  const offset = new Date(data.server_now).getTime() + (received - sent) / 2 - received
  return { ...data, offset }
}

export const saveAnswer = async (attemptId, questionId, { optionId = null, text = null }) =>
  unwrap(await supabase.rpc('save_quiz_answer', { p_attempt_id: attemptId, p_question_id: questionId, p_option_id: optionId, p_text: text }))

export async function fetchAttemptCount(quizId) {
  const { count, error } = await supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId)
  if (error) throw error
  return count ?? 0
}
