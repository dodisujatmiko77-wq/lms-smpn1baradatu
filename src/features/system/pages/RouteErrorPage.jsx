import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { AlertOctagon, Home, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui'

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i
const RELOAD_KEY = 'lms.chunkReloadAt'

/** Muat ulang otomatis sekali (maks. sekali per 30 detik) agar tidak berulang tanpa henti. */
function autoReloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }
  window.location.reload()
}

/**
 * Halaman error untuk rute. Gagal memuat modul halaman biasanya terjadi karena:
 * - versi aplikasi baru saja diperbarui (file lama sudah tidak ada) → muat ulang sekali otomatis;
 * - di komputer pengembang: library belum terpasang (`npm install`).
 */
export default function RouteErrorPage() {
  const error = useRouteError()
  const message = error?.message ?? String(error ?? '')
  const isChunk = CHUNK_ERROR.test(message)

  useEffect(() => {
    if (isChunk && import.meta.env.PROD) autoReloadOnce()
  }, [isChunk])

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <AlertOctagon className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">{isChunk ? 'Halaman gagal dimuat' : 'Terjadi kesalahan'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isChunk
            ? 'Aplikasi mungkin baru saja diperbarui atau koneksi terputus. Silakan muat ulang halaman.'
            : 'Maaf, terjadi kesalahan saat menampilkan halaman ini. Silakan muat ulang atau kembali ke beranda.'}
        </p>
        {import.meta.env.DEV && (
          <div className="mt-5 rounded-xl bg-slate-900 p-4 text-left text-xs text-slate-100">
            <p className="font-semibold text-accent-300">Info pengembang</p>
            <p className="mt-1 break-words font-mono">{message}</p>
            {isChunk && (
              <p className="mt-2 text-slate-300">
                Periksa terminal <code>npm run dev</code>. Bila ada pesan <i>“Failed to resolve import … Are they installed?”</i>, hentikan server
                (Ctrl+C), jalankan <code>npm install</code>, lalu <code>npm run dev</code> lagi.
              </p>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button icon={RotateCw} onClick={() => window.location.reload()}>Muat ulang</Button>
          <Button variant="outline" icon={Home} onClick={() => window.location.assign('/')}>Ke beranda</Button>
        </div>
      </div>
    </div>
  )
}
