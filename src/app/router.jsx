import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { CURRENT_STAGE, allNavItems } from '@/config/navigation'
import { ROLE_AREAS } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { HomeRedirect } from './guards/HomeRedirect'
import { RequireAuth } from './guards/RequireAuth'
import { RequireRole } from './guards/RequireRole'

// Halaman dimuat sesuai kebutuhan (code splitting) agar ringan di HP.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const ChangePasswordPage = lazy(() => import('@/features/auth/pages/ChangePasswordPage'))
const AdminDashboard = lazy(() => import('@/features/dashboard/pages/AdminDashboard'))
const TeacherDashboard = lazy(() => import('@/features/dashboard/pages/TeacherDashboard'))
const StudentDashboard = lazy(() => import('@/features/dashboard/pages/StudentDashboard'))
const AdminUsersPage = lazy(() => import('@/features/users/pages/AdminUsersPage'))
const SchoolSettingsPage = lazy(() => import('@/features/settings/pages/SchoolSettingsPage'))
const AuditLogPage = lazy(() => import('@/features/audit/pages/AuditLogPage'))
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'))
const ComingSoonPage = lazy(() => import('@/features/system/pages/ComingSoonPage'))
const NotFoundPage = lazy(() => import('@/features/system/pages/NotFoundPage'))

/** Rute "Segera hadir" dibuat otomatis dari menu yang tahapnya belum aktif. */
function comingSoonRoutes(role) {
  const prefix = ROLE_AREAS[role]
  return allNavItems()
    .filter((item) => item.role === role && item.stage > CURRENT_STAGE)
    .map((item) => ({
      path: item.to.slice(prefix.length + 1),
      handle: { title: item.label },
      element: <ComingSoonPage title={item.label} stage={item.stage} backTo={prefix} />,
    }))
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/lupa-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/ganti-password', element: <ChangePasswordPage /> },
      {
        element: <DashboardLayout />,
        children: [
          { path: '/profil', element: <ProfilePage />, handle: { title: 'Profil Saya' } },
          {
            path: '/admin',
            element: <RequireRole role="admin" />,
            children: [
              { index: true, element: <AdminDashboard />, handle: { title: 'Dashboard', isHome: true } },
              { path: 'akun', element: <AdminUsersPage />, handle: { title: 'Akun Pengguna', crumbs: [{ label: 'Pengguna' }] } },
              { path: 'pengaturan', element: <SchoolSettingsPage />, handle: { title: 'Pengaturan Sekolah', crumbs: [{ label: 'Sistem' }] } },
              { path: 'audit-log', element: <AuditLogPage />, handle: { title: 'Audit Log', crumbs: [{ label: 'Sistem' }] } },
              ...comingSoonRoutes('admin'),
            ],
          },
          {
            path: '/guru',
            element: <RequireRole role="teacher" />,
            children: [
              { index: true, element: <TeacherDashboard />, handle: { title: 'Dashboard', isHome: true } },
              ...comingSoonRoutes('teacher'),
            ],
          },
          {
            path: '/siswa',
            element: <RequireRole role="student" />,
            children: [
              { index: true, element: <StudentDashboard />, handle: { title: 'Beranda', isHome: true } },
              ...comingSoonRoutes('student'),
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
