import { cn } from '@/lib/utils'

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g

/** Teks biasa (bukan HTML) dengan tautan http(s) yang bisa diklik. */
export function LinkifiedText({ text, className }) {
  const parts = (text ?? '').split(URL_RE)
  return (
    <p className={cn('whitespace-pre-line break-words', className)}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary-600 underline underline-offset-2 hover:text-primary-700">{p}</a>
        ) : (
          p
        ),
      )}
    </p>
  )
}
