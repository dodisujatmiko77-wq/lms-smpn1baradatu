import { Badge } from '@/components/ui'

const ROLE = { teacher: ['Guru', 'blue'], staff: ['Guru', 'blue'], admin: ['Admin', 'violet'] }

/** Label peran penulis di forum (siswa tidak diberi label). */
export function RoleTag({ role }) {
  const r = ROLE[role]
  return r ? <Badge tone={r[1]}>{r[0]}</Badge> : null
}
