import { BookOpenCheck, ClipboardCheck, MessagesSquare, TrendingUp } from 'lucide-react'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { SchoolLogo } from '@/components/layout/SchoolLogo'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { APP_INFO } from '@/config/app'
import { cn } from '@/lib/utils'

const FEATURES = [
  { icon: BookOpenCheck, text: 'Materi dan pertemuan terstruktur di setiap mata pelajaran' },
  { icon: ClipboardCheck, text: 'Tugas, kuis, dan ujian online dengan umpan balik guru' },
  { icon: MessagesSquare, text: 'Forum diskusi kelas yang aman dan termoderasi' },
  { icon: TrendingUp, text: 'Pantau progress belajar secara nyata' },
]

/** Ilustrasi guru & siswa SMPN 1 Baradatu (WebP, dua ukuran agar ringan di HP). */
function HeroImage({ className, sizes }) {
  return (
    <img
      src="/brand/login-hero-768.webp"
      srcSet="/brand/login-hero-768.webp 768w, /brand/login-hero-1280.webp 1280w"
      sizes={sizes}
      width={1280}
      height={853}
      alt="Ilustrasi guru dan siswa SMP belajar bersama menggunakan laptop di kelas"
      fetchPriority="high"
      className={cn('block h-auto w-full', className)}
      draggable={false}
    />
  )
}

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
          <SchoolLogo className="h-12 w-12 shadow-lg shadow-primary-950/30" />
          <div>
            <p className="font-display text-lg font-semibold">{app_name}</p>
            <p className="text-sm text-primary-100">{school_name}</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-primary-50 ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" /> Transformasi Digital Sekolah
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-white xl:text-[2.6rem]">
            Ruang belajar digital untuk <span className="text-accent-300">guru</span> dan{' '}
            <span className="text-accent-300">siswa</span>.
          </h2>
          <p className="mt-3 text-base text-primary-100">{tagline}</p>

          <HeroImage className="mt-7 max-h-[44vh] object-cover object-[50%_35%] rounded-3xl shadow-2xl shadow-primary-950/40 ring-1 ring-white/20" sizes="(min-width: 1024px) 45vw, 100vw" />

          <ul className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-[13px] leading-snug text-primary-50">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-200">
          © {year} {school_name} · {address}
          <br />
          Dikembangkan oleh {APP_INFO.developer}
        </p>
      </section>

      <section className="relative flex flex-col justify-center bg-white px-5 py-10 sm:px-12">
        <ThemeToggle className="absolute right-3 top-3" />
        <div className="mx-auto w-full max-w-md">
          <HeroImage className="mb-6 aspect-[16/9] rounded-2xl object-cover object-[50%_35%] shadow-card lg:hidden" sizes="(max-width: 640px) 100vw, 448px" />
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <SchoolLogo className="h-14 w-14 shadow-md shadow-primary-600/30" />
            <div>
              <p className="font-display text-base font-semibold text-slate-900">{app_name}</p>
              <p className="text-xs text-slate-500">{school_name}</p>
            </div>
          </div>
          {children}
          <p className="mt-10 text-center text-xs text-slate-500 lg:hidden">
            © {year} {school_name}
            <br />
            Dikembangkan oleh {APP_INFO.developer}
          </p>
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
