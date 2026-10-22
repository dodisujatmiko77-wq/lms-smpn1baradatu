import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'

export function ForbiddenPage({
  title = 'Akses ditolak',
  message = 'Halaman ini tidak tersedia untuk role akun Anda.',
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <EmptyState
        icon={ShieldAlert}
        tone="danger"
        title={title}
        description={message}
        action={
          <Link to="/">
            <Button variant="outline">Ke halaman utama</Button>
          </Link>
        }
      />
    </div>
  )
}
