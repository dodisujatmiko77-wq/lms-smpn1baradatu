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
const QuestionBanksPage = lazy(() => import('@/features/quizzes/pages/QuestionBanksPage'))
const QuestionBankPage = lazy(() => import('@/features/quizzes/pages/QuestionBankPage'))
const QuizEditorPage = lazy(() => import('@/features/quizzes/pages/QuizEditorPage'))
const MyQuizzesPage = lazy(() => import('@/features/quizzes/pages/MyQuizzesPage'))
const QuizStartPage = lazy(() => import('@/features/quizzes/pages/QuizStartPage'))
const QuizTakePage = lazy(() => import('@/features/quizzes/pages/QuizTakePage'))
const QuizResultPage = lazy(() => import('@/features/quizzes/pages/QuizResultPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'))
const AnnouncementsPage = lazy(() => import('@/features/announcements/pages/AnnouncementsPage'))
const AnnouncementPage = lazy(() => import('@/features/announcements/pages/AnnouncementPage'))
const TopicPage = lazy(() => import('@/features/forum/pages/TopicPage'))
const CalendarPage = lazy(() => import('@/features/calendar/pages/CalendarPage'))
const AchievementsPage = lazy(() => import('@/features/achievements/pages/AchievementsPage'))
const LearningMonitorPage = lazy(() => import('@/features/reports/pages/LearningMonitorPage'))
const AssignmentMonitorPage = lazy(() => import('@/features/reports/pages/AssignmentMonitorPage'))
const AdminReportsPage = lazy(() => import('@/features/reports/pages/AdminReportsPage'))
const TeacherReportsPage = lazy(() => import('@/features/reports/pages/TeacherReportsPage'))
const GuardianClassPage = lazy(() => import('@/features/reports/pages/GuardianClassPage'))
const GuardianAssignmentsPage = lazy(() => import('@/features/reports/pages/GuardianAssignmentsPage'))
const FollowUpPage = lazy(() => import('@/features/reports/pages/FollowUpPage'))
const StudentReportPage = lazy(() => import('@/features/reports/pages/StudentReportPage'))
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
      // Mode fokus ujian: tanpa menu samping/bawah.
      {
        path: '/siswa/kuis/:quizId/kerjakan/:attemptId',
        element: <RequireRole role="student" />,
        children: [{ index: true, element: <QuizTakePage /> }],
      },
      {
        element: <DashboardLayout />,
        children: [
          { path: '/profil', element: <ProfilePage />, handle: { title: 'Profil Saya' } },
          { path: '/notifikasi', element: <NotificationsPage />, handle: { title: 'Notifikasi' } },
          { path: '/pengumuman/:id', element: <AnnouncementPage />, handle: { title: 'Pengumuman' } },
          { path: '/diskusi/:topicId', element: <TopicPage />, handle: { title: 'Diskusi' } },
          { path: '/laporan/siswa/:studentId', element: <StudentReportPage />, handle: { title: 'Laporan Siswa' } },
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
              { path: 'pengumuman', element: <AnnouncementsPage />, handle: { title: 'Pengumuman Sekolah', crumbs: [{ label: 'Pembelajaran' }] } },
              { path: 'kalender', element: <CalendarPage />, handle: { title: 'Kalender Sekolah', crumbs: [{ label: 'Akademik' }] } },
              { path: 'monitoring', element: <LearningMonitorPage />, handle: { title: 'Monitoring Pembelajaran', crumbs: [{ label: 'Pembelajaran' }] } },
              { path: 'monitoring-tugas', element: <AssignmentMonitorPage />, handle: { title: 'Monitoring Tugas', crumbs: [{ label: 'Pembelajaran' }] } },
              { path: 'laporan', element: <AdminReportsPage />, handle: { title: 'Laporan', crumbs: [{ label: 'Pembelajaran' }] } },
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
              { path: 'kelas/:taId/kuis/:quizId', element: <QuizEditorPage />, handle: { title: 'Kuis', crumbs: [{ label: 'Kelas Saya', to: '/guru/kelas' }] } },
              { path: 'pengumuman', element: <AnnouncementsPage />, handle: { title: 'Pengumuman' } },
              { path: 'kalender', element: <CalendarPage />, handle: { title: 'Kalender' } },
              { path: 'laporan', element: <TeacherReportsPage />, handle: { title: 'Laporan Pembelajaran' } },
              { path: 'wali-kelas', element: <GuardianClassPage />, handle: { title: 'Kelas Binaan', crumbs: [{ label: 'Wali Kelas' }] } },
              { path: 'wali-kelas/tugas', element: <GuardianAssignmentsPage />, handle: { title: 'Monitoring Tugas', crumbs: [{ label: 'Wali Kelas' }, { label: 'Kelas Binaan', to: '/guru/wali-kelas' }] } },
              { path: 'wali-kelas/tindak-lanjut', element: <FollowUpPage />, handle: { title: 'Perlu Tindak Lanjut', crumbs: [{ label: 'Wali Kelas' }, { label: 'Kelas Binaan', to: '/guru/wali-kelas' }] } },
              { path: 'bank-soal', element: <QuestionBanksPage />, handle: { title: 'Bank Soal' } },
              { path: 'bank-soal/:bankId', element: <QuestionBankPage />, handle: { title: 'Detail Bank Soal', crumbs: [{ label: 'Bank Soal', to: '/guru/bank-soal' }] } },
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
              { path: 'pengumuman', element: <AnnouncementsPage />, handle: { title: 'Pengumuman' } },
              { path: 'kalender', element: <CalendarPage />, handle: { title: 'Kalender' } },
              { path: 'pencapaian', element: <AchievementsPage />, handle: { title: 'Badge Saya' } },
              { path: 'kuis', element: <MyQuizzesPage />, handle: { title: 'Kuis & Ujian' } },
              { path: 'kuis/:quizId', element: <QuizStartPage />, handle: { title: 'Kuis', crumbs: [{ label: 'Kuis & Ujian', to: '/siswa/kuis' }] } },
              { path: 'kuis/:quizId/hasil/:attemptId', element: <QuizResultPage />, handle: { title: 'Hasil Kuis', crumbs: [{ label: 'Kuis & Ujian', to: '/siswa/kuis' }] } },
              ...comingSoonRoutes('student'),
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
