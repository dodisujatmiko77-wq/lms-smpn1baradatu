import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { CURRENT_STAGE, allNavItems } from '@/config/navigation'
import { ROLE_AREAS } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import RouteErrorPage from '@/features/system/pages/RouteErrorPage'
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
const AcademicYearsPage = lazy(() => import('@/features/academic/pages/AcademicYearsPage'))
const ClassesPage = lazy(() => import('@/features/classes/pages/ClassesPage'))
const ClassDetailPage = lazy(() => import('@/features/classes/pages/ClassDetailPage'))
const SubjectsPage = lazy(() => import('@/features/subjects/pages/SubjectsPage'))
const TeachersPage = lazy(() => import('@/features/teachers/pages/TeachersPage'))
const StudentsPage = lazy(() => import('@/features/students/pages/StudentsPage'))
const TeachingAssignmentsPage = lazy(() => import('@/features/assignments/pages/TeachingAssignmentsPage'))
const GuardiansPage = lazy(() => import('@/features/guardians/pages/GuardiansPage'))
const SchedulesPage = lazy(() => import('@/features/schedules/pages/SchedulesPage'))
const MySchedulePage = lazy(() => import('@/features/schedules/pages/MySchedulePage'))
const MyClassesPage = lazy(() => import('@/features/classroom/pages/MyClassesPage'))
const TeacherCoursePage = lazy(() => import('@/features/classroom/pages/TeacherCoursePage'))
const LessonEditorPage = lazy(() => import('@/features/classroom/pages/LessonEditorPage'))
const MyCoursesPage = lazy(() => import('@/features/classroom/pages/MyCoursesPage'))
const StudentCoursePage = lazy(() => import('@/features/classroom/pages/StudentCoursePage'))
const LessonReaderPage = lazy(() => import('@/features/classroom/pages/LessonReaderPage'))
const FileManagementPage = lazy(() => import('@/features/files/pages/FileManagementPage'))
const TaskEditorPage = lazy(() => import('@/features/tasks/pages/TaskEditorPage'))
const GradingQueuePage = lazy(() => import('@/features/tasks/pages/GradingQueuePage'))
const MyTasksPage = lazy(() => import('@/features/tasks/pages/MyTasksPage'))
const TaskSubmitPage = lazy(() => import('@/features/tasks/pages/TaskSubmitPage'))
const GradesPage = lazy(() => import('@/features/tasks/pages/GradesPage'))
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
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  { path: '/lupa-password', element: <ForgotPasswordPage />, errorElement: <RouteErrorPage /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <RouteErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
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
              { path: 'tahun-pelajaran', element: <AcademicYearsPage />, handle: { title: 'Tahun Pelajaran', crumbs: [{ label: 'Akademik' }] } },
              { path: 'kelas', element: <ClassesPage />, handle: { title: 'Kelas', crumbs: [{ label: 'Akademik' }] } },
              { path: 'kelas/:id', element: <ClassDetailPage />, handle: { title: 'Detail Kelas', crumbs: [{ label: 'Akademik' }, { label: 'Kelas', to: '/admin/kelas' }] } },
              { path: 'mapel', element: <SubjectsPage />, handle: { title: 'Mata Pelajaran', crumbs: [{ label: 'Akademik' }] } },
              { path: 'penugasan', element: <TeachingAssignmentsPage />, handle: { title: 'Penugasan Mengajar', crumbs: [{ label: 'Akademik' }] } },
              { path: 'wali-kelas', element: <GuardiansPage />, handle: { title: 'Wali Kelas', crumbs: [{ label: 'Akademik' }] } },
              { path: 'jadwal', element: <SchedulesPage />, handle: { title: 'Jadwal Pelajaran', crumbs: [{ label: 'Akademik' }] } },
              { path: 'guru', element: <TeachersPage />, handle: { title: 'Data Guru', crumbs: [{ label: 'Pengguna' }] } },
              { path: 'siswa', element: <StudentsPage />, handle: { title: 'Data Siswa', crumbs: [{ label: 'Pengguna' }] } },
              { path: 'file', element: <FileManagementPage />, handle: { title: 'Manajemen File', crumbs: [{ label: 'Pembelajaran' }] } },
              ...comingSoonRoutes('admin'),
            ],
          },
          {
            path: '/guru',
            element: <RequireRole role="teacher" />,
            children: [
              { index: true, element: <TeacherDashboard />, handle: { title: 'Dashboard', isHome: true } },
              { path: 'jadwal', element: <MySchedulePage />, handle: { title: 'Jadwal Mengajar' } },
              { path: 'kelas', element: <MyClassesPage />, handle: { title: 'Kelas Saya' } },
              { path: 'kelas/:taId', element: <TeacherCoursePage />, handle: { title: 'Ruang Kelas', crumbs: [{ label: 'Kelas Saya', to: '/guru/kelas' }] } },
              { path: 'kelas/:taId/pertemuan/:lessonId', element: <LessonEditorPage />, handle: { title: 'Edit Pertemuan', crumbs: [{ label: 'Kelas Saya', to: '/guru/kelas' }] } },
              { path: 'kelas/:taId/tugas/:taskId', element: <TaskEditorPage />, handle: { title: 'Tugas', crumbs: [{ label: 'Kelas Saya', to: '/guru/kelas' }] } },
              { path: 'pemeriksaan', element: <GradingQueuePage />, handle: { title: 'Pemeriksaan' } },
              ...comingSoonRoutes('teacher'),
            ],
          },
          {
            path: '/siswa',
            element: <RequireRole role="student" />,
            children: [
              { index: true, element: <StudentDashboard />, handle: { title: 'Beranda', isHome: true } },
              { path: 'jadwal', element: <MySchedulePage />, handle: { title: 'Jadwal Pelajaran' } },
              { path: 'mapel', element: <MyCoursesPage />, handle: { title: 'Mata Pelajaran' } },
              { path: 'mapel/:taId', element: <StudentCoursePage />, handle: { title: 'Ruang Belajar', crumbs: [{ label: 'Mata Pelajaran', to: '/siswa/mapel' }] } },
              { path: 'mapel/:taId/pertemuan/:lessonId', element: <LessonReaderPage />, handle: { title: 'Materi', crumbs: [{ label: 'Mata Pelajaran', to: '/siswa/mapel' }] } },
              { path: 'tugas', element: <MyTasksPage />, handle: { title: 'Tugas' } },
              { path: 'tugas/:taskId', element: <TaskSubmitPage />, handle: { title: 'Kerjakan Tugas', crumbs: [{ label: 'Tugas', to: '/siswa/tugas' }] } },
              { path: 'nilai', element: <GradesPage />, handle: { title: 'Nilai & Umpan Balik' } },
              ...comingSoonRoutes('student'),
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
