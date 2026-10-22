import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

// Tautan di konten selalu dibuka di tab baru tanpa akses ke halaman LMS.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

const CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
}

/** Menampilkan HTML materi yang sudah disanitasi (mencegah XSS). */
export function RichContent({ html, className }) {
  const clean = useMemo(() => DOMPurify.sanitize(html ?? '', CONFIG), [html])
  if (!clean.trim()) return null
  return <div className={cn('prose-lms', className)} dangerouslySetInnerHTML={{ __html: clean }} />
}
