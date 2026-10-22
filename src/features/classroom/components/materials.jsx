import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, FileSpreadsheet, FileText, Film, Image as ImageIcon, Link2, Loader2, Presentation, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Modal } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/files'
import { cn } from '@/lib/utils'
import { youtubeEmbed, youtubeId, youtubeThumb } from '@/lib/youtube'
import { ckeys, signedUrl } from '../api'

export const MATERIAL_META = {
  pdf: { label: 'PDF', icon: FileText, tone: 'bg-red-50 text-red-600' },
  image: { label: 'Gambar', icon: ImageIcon, tone: 'bg-emerald-50 text-emerald-600' },
  video: { label: 'Video', icon: Film, tone: 'bg-rose-50 text-rose-600' },
  link: { label: 'Tautan', icon: Link2, tone: 'bg-primary-50 text-primary-600' },
  presentation: { label: 'Presentasi', icon: Presentation, tone: 'bg-accent-50 text-accent-600' },
  document: { label: 'Dokumen', icon: FileText, tone: 'bg-sky-50 text-sky-600' },
  file: { label: 'Berkas', icon: FileSpreadsheet, tone: 'bg-violet-50 text-violet-600' },
}

/** Signed URL (1 jam) di-cache 50 menit agar tidak meminta ulang tiap render. */
export function useSignedUrl(path, enabled = true) {
  return useQuery({ queryKey: ckeys.signed(path), queryFn: () => signedUrl(path), enabled: Boolean(path) && enabled, staleTime: 50 * 60_000, gcTime: 55 * 60_000 })
}

async function openSigned(material, download) {
  const win = download ? null : window.open('', '_blank')
  try {
    const url = await signedUrl(material.storage_path, download ? material.file_name ?? true : undefined)
    if (win) win.location.href = url
    else window.location.href = url
  } catch (e) {
    win?.close()
    toast.error(toMessage(e))
  }
}

function MaterialIcon({ type, className }) {
  const meta = MATERIAL_META[type] ?? MATERIAL_META.file
  return (
    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', meta.tone, className)}>
      <meta.icon className="h-5 w-5" />
    </span>
  )
}

function YouTubeEmbed({ material }) {
  const id = youtubeId(material.url)
  const [play, setPlay] = useState(false)
  if (!id) return null
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
      {play ? (
        <iframe
          src={`${youtubeEmbed(id)}&autoplay=1`}
          title={material.title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        // Thumbnail dulu: video baru dimuat saat diputar (hemat kuota internet siswa).
        <button onClick={() => setPlay(true)} className="group absolute inset-0" aria-label={`Putar video ${material.title}`}>
          <img
            src={youtubeThumb(id)}
            alt=""
            className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-red-600 text-white shadow-xl transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

function InlineImage({ material }) {
  const { data: url, isLoading } = useSignedUrl(material.storage_path)
  if (isLoading) return <div className="aspect-video animate-pulse rounded-xl bg-slate-100" />
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
      <img src={url} alt={material.title} loading="lazy" className="mx-auto max-h-[520px] w-auto object-contain" />
    </a>
  )
}

function PdfViewerModal({ material, onClose }) {
  const { data: url, isLoading } = useSignedUrl(material?.storage_path, Boolean(material))
  return (
    <Modal open={Boolean(material)} onClose={onClose} size="lg" title={material?.title ?? ''}>
      {isLoading || !url ? (
        <div className="grid h-[70vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-3">
          <iframe src={url} title={material.title} className="h-[70vh] w-full rounded-lg border border-slate-200" />
          <div className="flex justify-end">
            <a href={url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" icon={ExternalLink}>Buka di tab baru</Button></a>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Daftar materi. mode 'read' (siswa: video & gambar tampil langsung) atau 'manage' (guru: bisa hapus). */
export function MaterialList({ materials, mode = 'read', onDelete }) {
  const [pdf, setPdf] = useState(null)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  if (!materials?.length) return null
  return (
    <>
      <ul className="space-y-3">
        {materials.map((m) => {
          const meta = MATERIAL_META[m.type] ?? MATERIAL_META.file
          const inline = mode === 'read' && (m.type === 'video' || m.type === 'image')
          return (
            <li key={m.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
              <div className="flex items-center gap-3">
                <MaterialIcon type={m.type} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900">{m.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {meta.label}
                    {m.size_bytes ? ` · ${formatBytes(m.size_bytes)}` : ''}
                    {m.type === 'link' ? ` · ${new URL(m.url).hostname}` : ''}
                  </p>
                </div>
                {m.type === 'link' && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer nofollow"><Button variant="outline" size="sm" icon={ExternalLink}>Buka</Button></a>
                )}
                {m.type === 'video' && mode === 'manage' && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" icon={ExternalLink}>YouTube</Button></a>
                )}
                {m.type === 'pdf' && (
                  <Button variant="outline" size="sm" icon={FileText} onClick={() => (isMobile ? openSigned(m) : setPdf(m))}>Baca</Button>
                )}
                {m.storage_path && (
                  <Button variant="ghost" size="icon-sm" onClick={() => openSigned(m, true)} aria-label={`Unduh ${m.title}`} title="Unduh">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                {mode === 'manage' && onDelete && (
                  <Button variant="ghost" size="icon-sm" onClick={() => onDelete(m)} aria-label={`Hapus ${m.title}`} title="Hapus">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
              {inline && <div className="mt-3">{m.type === 'video' ? <YouTubeEmbed material={m} /> : <InlineImage material={m} />}</div>}
            </li>
          )
        })}
      </ul>
      <PdfViewerModal material={pdf} onClose={() => setPdf(null)} />
    </>
  )
}
