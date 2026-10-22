import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <EmptyState
        icon={Compass}
        title="Halaman tidak ditemukan"
        description="Alamat yang Anda buka tidak tersedia atau sudah dipindahkan."
        action={
          <Link to="/">
            <Button>Kembali ke beranda</Button>
          </Link>
        }
      />
    </div>
  )
}
