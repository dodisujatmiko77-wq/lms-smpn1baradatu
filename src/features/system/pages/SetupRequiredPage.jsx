import { Database } from 'lucide-react'

/** Tampil bila variabel lingkungan Supabase belum diatur (.env.local). */
export default function SetupRequiredPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-50 text-accent-600">
          <Database className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">Konfigurasi Supabase belum diatur</h1>
        <p className="mt-2 text-sm text-slate-600">
          Salin berkas <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.example</code> menjadi{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code>, isi URL dan anon key proyek Supabase, lalu jalankan ulang{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run dev</code>.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_LOGIN_EMAIL_DOMAIN=lms.smpn1baradatu.sch.id`}
        </pre>
        <p className="mt-4 text-xs text-slate-500">Jangan pernah memasukkan service_role key ke berkas frontend.</p>
      </div>
    </div>
  )
}
