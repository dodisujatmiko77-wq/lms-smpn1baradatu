import { AlertOctagon, RotateCw } from 'lucide-react'
import { toMessage } from '@/lib/errors'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

export function ErrorState({ error, onRetry, title = 'Gagal memuat data' }) {
  return (
    <EmptyState
      icon={AlertOctagon}
      tone="danger"
      title={title}
      description={toMessage(error)}
      action={
        onRetry && (
          <Button variant="outline" icon={RotateCw} onClick={onRetry}>
            Coba lagi
          </Button>
        )
      }
    />
  )
}
