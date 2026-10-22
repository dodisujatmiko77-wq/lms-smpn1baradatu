import { BookOpenCheck, ClipboardCheck, MessagesSquare, TrendingUp } from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { SchoolLogo } from '@/components/layout/SchoolLogo'

const FEATURES = [
  { icon: BookOpenCheck, text: 'Materi dan pertemuan terstruktur di setiap mata pelajaran' },
  { icon: ClipboardCheck, text: 'Tugas, kuis, dan ujian online dengan umpan balik guru' },
  { icon: MessagesSquare, text: 'Forum diskusi kelas yang aman dan termoderasi' },
  { icon: TrendingUp, text: 'Pantau progress belajar secara nyata' },
]

/** Tata letak halaman autentikasi dengan identitas sekolah dari pengaturan terpusat. */
export function AuthLayout({ children }) {
  const { school_name, app_name, tagline, address } = useSchoolSettings()
  const year = new Date().getFullYear()

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-accent-500/15 blur-2xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
        />

        <div className="relative flex items-center gap-3">
          <div>
            <p className="font-display text-lg font-semibold">{app_name}</p>
            <p className="text-sm text-primary-100">{school_name}</p>
          </div>
        </div>

        <div className="relative my-auto max-w-lg py-12">
          <SchoolLogo className="mb-8 h-28 w-28 rounded-3xl shadow-2xl shadow-primary-950/40" />
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-primary-50 ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" /> Transformasi Digital Sekolah
          </span>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-white xl:text-[2.75rem]">
            Ruang belajar digital untuk <span className="text-accent-300">guru</span> dan{' '}
            <span className="text-accent-300">siswa</span>.
          </h2>
          <p className="mt-4 text-base text-primary-100">{tagline}</p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-primary-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-200">
          © {year} {school_name} · {address}
        </p>
      </section>

      <section className="flex flex-col justify-center bg-white px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <SchoolLogo className="h-14 w-14 shadow-md shadow-primary-600/30" />
            <div>
              <p className="font-display text-base font-semibold text-slate-900">{app_name}</p>
              <p className="text-xs text-slate-500">{school_name}</p>
            </div>
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}

export function AuthAlert({ tone = 'error', children }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-success-100 bg-success-50 text-success-700',
    info: 'border-primary-100 bg-primary-50 text-primary-800',
  }
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  )
}
