import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchReportClasses, rkeys } from './api'

/** Kelas yang boleh dilaporkan + pilihan aktif (default kelas pertama). guardianOnly = hanya kelas binaan. */
export function useReportClasses({ guardianOnly = false } = {}) {
  const q = useQuery({ queryKey: rkeys.classes, queryFn: fetchReportClasses })
  const [picked, setPicked] = useState(null)
  const classes = (q.data ?? []).filter((c) => !guardianOnly || c.is_guardian)
  const current = classes.find((c) => c.id === picked) ?? classes[0] ?? null
  return { ...q, classes, current, setPicked }
}
