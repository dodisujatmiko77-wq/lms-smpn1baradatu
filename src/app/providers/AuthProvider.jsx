import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { loginIdToEmail, primaryRole } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'

const AuthContext = createContext(null)
const LAST_AREA_KEY = 'lms.lastRole'

function readLastRole() {
  try {
    return localStorage.getItem(LAST_AREA_KEY)
  } catch {
    return null
  }
}

/**
 * Menyimpan sesi Supabase + konteks pengguna (profil & role dari RPC get_my_context).
 * Pemeriksaan role di sini hanya untuk UX; hak akses sebenarnya ditegakkan RLS.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum diketahui
  const [authNotice, setAuthNotice] = useState(null)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [lastRole, setLastRoleState] = useState(readLastRole)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Jangan memanggil API Supabase lain langsung di dalam callback ini.
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(nextSession ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  const contextQuery = useQuery({
    queryKey: ['me', userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_context')
      if (error) throw error
      if (!data) throw new Error('Profil akun tidak ditemukan. Hubungi administrator.')
      if (!data.is_active) {
        setAuthNotice('Akun Anda sedang dinonaktifkan. Hubungi administrator sekolah.')
        await supabase.auth.signOut()
        return null
      }
      return data
    },
  })

  const profile = userId ? (contextQuery.data ?? null) : null
  const refetchContext = contextQuery.refetch
  const loadProfile = useCallback(() => refetchContext(), [refetchContext])

  const signIn = useCallback(async (loginId, password) => {
    setAuthNotice(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginIdToEmail(loginId),
      password,
    })
    if (error) throw error
    await supabase.rpc('record_login')
    return data
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [])

  const setLastRole = useCallback((role) => {
    setLastRoleState(role)
    try {
      localStorage.setItem(LAST_AREA_KEY, role)
    } catch {
      /* penyimpanan lokal tidak tersedia — abaikan */
    }
  }, [])

  const value = useMemo(() => {
    const roles = profile?.roles ?? []
    const defaultRole = roles.includes(lastRole) ? lastRole : primaryRole(roles)
    return {
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isGuardian: (profile?.guardian_class_ids?.length ?? 0) > 0,
      defaultRole,
      setLastRole,
      loading: session === undefined || (Boolean(userId) && contextQuery.isPending),
      profileError: contextQuery.error,
      authNotice,
      setAuthNotice,
      recoveryMode,
      setRecoveryMode,
      signIn,
      signOut,
      refreshProfile: loadProfile,
    }
  }, [session, profile, lastRole, setLastRole, userId, contextQuery.isPending, contextQuery.error, authNotice, recoveryMode, signIn, signOut, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
