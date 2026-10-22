const LABELS = {
  'user.create': 'Membuat akun',
  'user.reset_password': 'Mereset password',
  'user.activate': 'Mengaktifkan akun',
  'user.deactivate': 'Menonaktifkan akun',
  'user.set_roles': 'Mengubah role akun',
  'user.update_profile': 'Mengubah data profil',
  'user_roles.insert': 'Menambah role',
  'user_roles.delete': 'Mencabut role',
  'school_settings.update': 'Mengubah pengaturan sekolah',
}

export function actionLabel(action) {
  return LABELS[action] ?? action
}

export function actionTone(action) {
  if (/deactivate|delete|reset/.test(action)) return 'red'
  if (/create|insert|activate/.test(action)) return 'green'
  return 'blue'
}
