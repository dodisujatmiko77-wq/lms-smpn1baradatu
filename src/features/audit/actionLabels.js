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
