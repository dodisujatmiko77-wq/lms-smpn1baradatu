// Membuat blok "warna tipis & teks berwarna" di src/styles/dark.css.
// Jalankan: node scripts/gen-dark-colors.mjs, lalu salin keluarannya ke dalam blok tersebut.
const F = {
  primary: ['#3b82f6', '#93c5fd'], accent: ['#f97316', '#fdba74'], success: ['#22c55e', '#86efac'],
  red: ['#ef4444', '#fca5a5'], amber: ['#f59e0b', '#fcd34d'], emerald: ['#10b981', '#6ee7b7'], sky: ['#0ea5e9', '#7dd3fc'],
  indigo: ['#6366f1', '#a5b4fc'], violet: ['#8b5cf6', '#c4b5fd'], pink: ['#ec4899', '#f9a8d4'], rose: ['#f43f5e', '#fda4af'],
}
const mix = (hex, pct) => `color-mix(in srgb, ${hex} ${pct}%, transparent)`
const esc = (c) => c.replace(/[:/.]/g, (m) => '\\' + m)
const TINT = { 50: 12, 100: 18, 200: 26 }
const BORDER = { 100: 22, 200: 30, 300: 42 }
const lines = []
const rule = (sel, decl) => lines.push(`  ${sel} { ${decl} }`)
for (const [f, [c500, c300]] of Object.entries(F)) {
  lines.push(`  /* ${f} */`)
  for (const [shade, pct] of Object.entries(TINT)) {
    rule(`:where(.dark) .${esc(`bg-${f}-${shade}`)}`, `background-color: ${mix(c500, pct)};`)
    if (shade === '50') for (const op of [40, 50, 60, 70]) rule(`:where(.dark) .${esc(`bg-${f}-${shade}/${op}`)}`, `background-color: ${mix(c500, Math.round(pct * op / 100))};`)
    rule(`:where(.dark) .${esc(`hover:bg-${f}-${shade}`)}:hover`, `background-color: ${mix(c500, pct + 6)};`)
    if (shade !== '50') continue
    rule(`:where(.dark) .${esc(`hover:bg-${f}-${shade}/40`)}:hover`, `background-color: ${mix(c500, pct)};`)
    rule(`:where(.dark) .${esc(`from-${f}-${shade}`)}`, `--tw-gradient-from: ${mix(c500, pct)};`)
    rule(`:where(.dark) .${esc(`to-${f}-${shade}`)}`, `--tw-gradient-to: ${mix(c500, pct)};`)
  }
  rule(`:where(.dark) .${esc(`ring-${f}-200`)}`, `--tw-ring-color: ${mix(c500, 40)};`)
  for (const [shade, pct] of Object.entries(BORDER)) {
    rule(`:where(.dark) .${esc(`border-${f}-${shade}`)}`, `border-color: ${mix(c500, pct)};`)
    rule(`:where(.dark) .${esc(`hover:border-${f}-${shade}`)}:hover`, `border-color: ${mix(c500, pct + 10)};`)
  }
  for (const shade of [600, 700, 800, 900]) {
    rule(`:where(.dark) .${esc(`text-${f}-${shade}`)}`, `color: ${c300};`)
    rule(`:where(.dark) .${esc(`hover:text-${f}-${shade}`)}:hover`, `color: ${c300};`)
  }
}
console.log(lines.join('\n'))
