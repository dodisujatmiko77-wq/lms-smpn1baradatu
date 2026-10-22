import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Content-Security-Policy dasar. Nilai yang sama dipasang di netlify.toml & vercel.json;
 * di sini dipakai untuk `npm run preview` agar kebijakan bisa diuji secara lokal.
 */
export function contentSecurityPolicy(extraOrigins = []) {
  const extra = extraOrigins.join(' ')
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: https://*.supabase.co https://i.ytimg.com ${extra}`,
    `media-src 'self' blob: https://*.supabase.co ${extra}`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com ${extra} ${extra.replace(/http/g, 'ws')}`,
    `frame-src https://www.youtube-nocookie.com https://*.supabase.co ${extra}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: aplikasi bisa dipasang di layar utama HP dan memuat lebih cepat.
    // Data (Supabase) selalu diambil dari jaringan — tidak ada data sekolah yang disimpan di cache.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'brand/apple-touch-icon.png'],
      manifest: {
        name: 'LMS Digital — UPT SMP Negeri 1 Baradatu',
        short_name: 'LMS Baradatu',
        description: 'Ruang belajar digital UPT SMP Negeri 1 Baradatu, Way Kanan',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Pra-unduh hanya kerangka aplikasi agar hemat kuota HP; potongan halaman lain
        // disimpan saat pertama kali dibuka (nama berkas ber-hash, aman disimpan lama).
        globPatterns: ['index.html', 'assets/index-*.{js,css}', 'assets/rolldown-runtime-*.js', 'assets/App-*.js', 'favicon.ico', 'brand/icon-192.png', 'brand/logo-256.webp'],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'app-assets', expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/brand/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'brand', expiration: { maxEntries: 20 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  preview: {
    headers: {
      'Content-Security-Policy': contentSecurityPolicy([new URL(loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL || 'https://x.supabase.co').origin]),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  // exceljs dimuat dinamis; dioptimasi sejak awal agar dev server tidak memuat ulang di tengah jalan.
  optimizeDeps: { include: ['exceljs'] },
}))
