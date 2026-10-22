/** Ambil ID video dari berbagai format URL YouTube; null bila bukan YouTube. */
export function youtubeId(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/)
      if (m) return m[2]
    }
  } catch {
    /* bukan URL */
  }
  return null
}

/** URL embed privasi-tinggi (tanpa cookie pelacak). */
export const youtubeEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`
export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
