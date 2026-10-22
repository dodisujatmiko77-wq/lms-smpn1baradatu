import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button, Modal } from '@/components/ui'

/** Menampilkan password sementara SEKALI saja setelah akun dibuat / direset. */
export function CredentialModal({ credential, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!credential) return null
  const text = `Akun LMS\nUsername: ${credential.username}\nPassword sementara: ${credential.password}\nGanti password saat login pertama.`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard tidak tersedia */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={credential.title}
      size="sm"
      footer={
        <>
          <Button variant="outline" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? 'Tersalin' : 'Salin'}
          </Button>
          <Button onClick={onClose}>Selesai</Button>
        </>
      }
    >
      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/60 p-4">
        <div className="flex items-center gap-2 text-primary-700">
          <KeyRound className="h-4 w-4" />
          <span className="text-sm font-semibold">{credential.full_name}</span>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Username</dt>
            <dd className="font-mono font-semibold text-slate-900">{credential.username}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Password sementara</dt>
            <dd className="font-mono text-base font-semibold tracking-wider text-slate-900">{credential.password}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Catat dan serahkan kepada pemilik akun. Password ini tidak dapat ditampilkan lagi; pengguna wajib menggantinya saat login pertama.
      </p>
    </Modal>
  )
}
