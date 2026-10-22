import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { isSupabaseConfigured } from '@/lib/supabase'
import './styles/index.css'

const App = lazy(() => import('./app/App'))
const SetupRequiredPage = lazy(() => import('./features/system/pages/SetupRequiredPage'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>{isSupabaseConfigured ? <App /> : <SetupRequiredPage />}</Suspense>
  </StrictMode>,
)
