import { useQuery } from '@tanstack/react-query'
import { randomId } from '@/lib/files'
import { supabase } from '@/lib/supabase'

export const AVATAR_BUCKET = 'avatars'
const URL_TTL = 60 * 60 // detik

/** Signed URL foto profil (bucket privat); disegarkan sebelum kedaluwarsa. */
export function useAvatarUrl(path) {
  return useQuery({
    queryKey: ['avatar-url', path],
    enabled: Boolean(path),
    staleTime: (URL_TTL - 10 * 60) * 1000,
    gcTime: URL_TTL * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, URL_TTL)
      if (error) throw error
      return data.signedUrl
    },
  }).data
}

/** Potong gambar menjadi persegi di tengah lalu perkecil ke 320px WebP (±20–40 KB). */
export async function squareAvatar(file, size = 320) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
  if (!blob) throw new Error('Gambar tidak dapat diproses. Coba foto lain.')
  return blob
}

/** Unggah foto baru, simpan path di profil, lalu hapus foto lama. */
export async function uploadAvatar(profile, file) {
  const blob = await squareAvatar(file)
  const path = `${profile.id}/${randomId()}.webp`
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: 'image/webp' })
  if (upErr) throw upErr
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id)
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
    throw error
  }
  if (profile.avatar_path) await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path])
}

export async function removeAvatar(profile) {
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', profile.id)
  if (error) throw error
  if (profile.avatar_path) await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path])
}
