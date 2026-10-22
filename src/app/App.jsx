import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from './providers/AuthProvider'
import { SettingsProvider } from './providers/SettingsProvider'
import { router } from './router'

// Desktop: kanan bawah (tidak menutupi tombol aksi di kanan atas halaman).
// HP: atas tengah (tidak menutupi tombol modal & navigasi bawah).
const TOAST_POSITION = window.matchMedia('(min-width: 768px)').matches ? 'bottom-right' : 'top-center'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <Suspense fallback={<FullPageLoader />}>
            <RouterProvider router={router} />
          </Suspense>
        </AuthProvider>
      </SettingsProvider>
      <Toaster position={TOAST_POSITION} richColors closeButton toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
    </QueryClientProvider>
  )
}
