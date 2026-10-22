import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageUp, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { SCHOOL_SETTINGS_KEY, useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Button } from '@/components/ui'
import { SchoolLogo } from '@/components/layout/SchoolLogo'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { compressImage } from '@/lib/files'
import { supabase } from '@/lib/supabase'

const BUCKET = 'public-assets'

/** Unggah logo sekolah ke bucket publik; logo lama dihapus setelah logo baru tersimpan. */
export function LogoUploader() {
  const { logo_path } = useSchoolSettings()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  const save = async (path) => {
    const saved = unwrap(await supabase.from('school_settings').update({ logo_path: path }).eq('id', true).select().single())
    qc.setQueryData(SCHOOL_SETTINGS_KEY, saved)
  }

  const upload = async (file) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return toast.error('Gunakan gambar PNG, JPG, atau WebP.')
    setBusy(true)
    try {
      const small = await compressImage(file, { maxSize: 512, quality: 0.9 })
      if (small.size > 2 * 1024 * 1024) throw new Error('Ukuran logo maksimal 2 MB.')
      const ext = small.type === 'image/webp' ? 'webp' : small.type === 'image/png' ? 'png' : 'jpg'
      const path = `school/logo-${Date.now()}.${ext}`
      unwrap(await supabase.storage.from(BUCKET).upload(path, small, { contentType: small.type, cacheControl: '31536000' }))
      const old = logo_path
      await save(path)
      if (old) await supabase.storage.from(BUCKET).remove([old])
      toast.success('Logo sekolah diperbarui.')
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  const resetDefault = async () => {
    setBusy(true)
    try {
      const old = logo_path
      await save(null)
      if (old) await supabase.storage.from(BUCKET).remove([old])
      toast.success('Kembali memakai logo bawaan.')
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-slate-200 p-4 sm:flex-row sm:items-center">
      <SchoolLogo className="h-20 w-20" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-slate-800">Logo sekolah</p>
        <p className="text-slate-500">PNG/JPG/WebP persegi, minimal 256×256 px. Dipakai di halaman login, sidebar, dan ikon aplikasi.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" icon={ImageUp} loading={busy} onClick={() => ref.current?.click()}>Unggah logo</Button>
          {logo_path && <Button type="button" size="sm" variant="ghost" icon={RotateCcw} disabled={busy} onClick={resetDefault}>Pakai logo bawaan</Button>}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
    </div>
  )
}
