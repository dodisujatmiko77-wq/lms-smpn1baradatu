import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { z } from 'zod'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from './providers/AuthProvider'
import { SettingsProvider } from './providers/SettingsProvider'
import { ThemeProvider, useTheme } from './providers/ThemeProvider'
import { router } from './router'

// Validasi tanpa eval/new Function agar sesuai Content-Security-Policy (script-src 'self').
z.config({ jitless: true })

// Desktop: kanan bawah (tidak menutupi tombol aksi di kanan atas halaman).
// HP: atas tengah (tidak menutupi tombol modal & navigasi bawah).
const TOAST_POSITION = window.matchMedia('(min-width: 768px)').matches ? 'bottom-right' : 'top-center'

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster position={TOAST_POSITION} theme={resolved} richColors closeButton toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
}

export default function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <Suspense fallback={<FullPageLoader />}>
            <RouterProvider router={router} />
          </Suspense>
        </AuthProvider>
      </SettingsProvider>
      <ThemedToaster />
    </QueryClientProvider>
    </ThemeProvider>
  )
}
