import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { toMessage } from '@/lib/errors'
import { removeAvatar, uploadAvatar } from '../avatar'
import { MyAvatar } from './MyAvatar'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 10

/** Foto profil dengan tombol ganti & hapus. Foto otomatis dipotong persegi dan diperkecil. */
export function AvatarUploader() {
  const { profile, refreshProfile } = useAuth()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(null)

  const pick = async (file) => {
    if (!file) return
    if (!ACCEPT.includes(file.type)) return toast.error('Gunakan foto berformat JPG, PNG, atau WebP.')
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Ukuran foto maksimal ${MAX_MB} MB.`)
    setBusy('upload')
    try {
      await uploadAvatar(profile, file)
      await refreshProfile()
      toast.success('Foto profil diperbarui.')
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy('remove')
    try {
      await removeAvatar(profile)
      await refreshProfile()
      toast.success('Foto profil dihapus.')
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="relative">
        <MyAvatar size="xl" className="ring-4 ring-white" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary-600 text-white shadow-md ring-2 ring-white hover:bg-primary-700 disabled:opacity-70"
          aria-label={profile.avatar_path ? 'Ganti foto profil' : 'Unggah foto profil'}
          title={profile.avatar_path ? 'Ganti foto' : 'Unggah foto'}
        >
          {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {profile.avatar_path && (
        <button
          type="button"
          onClick={remove}
          disabled={!!busy}
          className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus foto
        </button>
      )}
    </div>
  )
}
