const LABELS = {
  'user.create': 'Membuat akun',
  'user.bulk_create': 'Impor akun massal',
  'user.reset_password': 'Mereset password',
  'user.activate': 'Mengaktifkan akun',
  'user.deactivate': 'Menonaktifkan akun',
  'user.set_roles': 'Mengubah role akun',
  'user.update_profile': 'Mengubah data profil',
  'class_enrollments.insert': 'Menempatkan siswa',
  'class_enrollments.update': 'Memindahkan kelas siswa',
  'class_enrollments.delete': 'Mengeluarkan siswa dari kelas',
  'class_guardians.insert': 'Menetapkan wali kelas',
  'class_guardians.update': 'Mengganti wali kelas',
  'class_guardians.delete': 'Mengosongkan wali kelas',
  'semesters.update': 'Mengubah semester',
  'lessons.publish': 'Menerbitkan materi',
  'lessons.unpublish': 'Menarik materi ke draf',
  'lessons.delete': 'Menghapus pertemuan',
  'assignments.publish': 'Menerbitkan tugas',
  'assignments.unpublish': 'Menarik tugas ke draf',
  'assignments.delete': 'Menghapus tugas',
  'assignment_grades.insert': 'Memberi nilai tugas',
  'assignment_grades.update': 'Mengubah nilai tugas',
  'assignment_grades.delete': 'Menghapus nilai tugas',
  'assignment_grades.publish': 'Menerbitkan nilai tugas',
  'quizzes.publish': 'Menerbitkan kuis',
  'quizzes.unpublish': 'Menarik kuis ke draf',
  'quizzes.delete': 'Menghapus kuis',
  'quiz_answers.grade': 'Menilai esai kuis',
  'quiz_attempts.reset': 'Mereset percobaan kuis',
  'announcements.delete': 'Menghapus pengumuman',
  'storage.purge_submissions': 'Membersihkan berkas jawaban semester lalu',
  'discussion_topics.hide': 'Menyembunyikan topik diskusi',
  'discussion_topics.unhide': 'Menampilkan topik diskusi',
  'discussion_topics.delete': 'Menghapus topik diskusi',
  'discussion_replies.hide': 'Menyembunyikan balasan diskusi',
  'discussion_replies.unhide': 'Menampilkan balasan diskusi',
  'discussion_replies.delete': 'Menghapus balasan diskusi',
}

const ENTITIES = {
  school_settings: 'pengaturan sekolah',
  user_roles: 'role',
  teaching_assignments: 'penugasan mengajar',
  students: 'data siswa',
  teachers: 'data guru',
  classes: 'kelas',
  subjects: 'mata pelajaran',
}

const OPS = { insert: 'Menambah', update: 'Mengubah', delete: 'Menghapus' }

export function actionLabel(action) {
  if (LABELS[action]) return LABELS[action]
  const [entity, op] = action.split('.')
  if (ENTITIES[entity] && OPS[op]) return `${OPS[op]} ${ENTITIES[entity]}`
  return action
}

export function actionTone(action) {
  if (/deactivate|delete|reset/.test(action)) return 'red'
  if (/create|insert|activate/.test(action)) return 'green'
  return 'blue'
}
