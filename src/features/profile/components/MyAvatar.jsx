import { useState } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Avatar } from '@/components/ui'
import { useAvatarUrl } from '../avatar'

/** Foto profil pengguna yang sedang masuk; inisial nama bila belum ada foto. */
export function MyAvatar(props) {
  const { profile } = useAuth()
  const url = useAvatarUrl(profile?.avatar_path)
  const [failedUrl, setFailedUrl] = useState(null)
  return <Avatar name={profile?.full_name} src={url && url !== failedUrl ? url : undefined} onError={() => setFailedUrl(url)} {...props} />
}
