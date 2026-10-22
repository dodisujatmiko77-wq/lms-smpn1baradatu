import { GraduationCap } from 'lucide-react'

export function FullPageLoader({ label = 'Memuat…' }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-primary-400/40" />
          <GraduationCap className="relative h-7 w-7" />
        </span>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}
