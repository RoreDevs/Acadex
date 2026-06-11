import { createBrowserRouter } from 'react-router-dom';
import { DashboardLayout, SuperAdminLayout, AuthLayout } from '@/layouts/DashboardLayout';
import { RouteGuard, PublicRoute } from '@/components/shared/RouteGuard';

// Auth
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { SuperAdminRegisterPage } from '@/pages/auth/SuperAdminRegisterPage';

// Student Pages
import { StudentDashboardPage } from '@/pages/student/DashboardPage';
import { ProfilePage } from '@/pages/student/ProfilePage';
import { MarkAttendancePage } from '@/pages/student/MarkAttendancePage';
import { RecordsPage } from '@/pages/student/RecordsPage';
import { CoursesPage } from '@/pages/student/CoursesPage';

// Admin Pages
import { AdminDashboardPage } from '@/pages/admin/DashboardPage';
import { GenerateSessionPage } from '@/pages/admin/GenerateSessionPage';
import { SessionManagementPage } from '@/pages/admin/SessionManagementPage';
import { AttendanceTrackingPage } from '@/pages/admin/AttendanceTrackingPage';
import { AdminCoursesPage } from '@/pages/admin/CoursesPage';
import { AdminAnalyticsPage } from '@/pages/admin/AnalyticsPage';

// Super Admin Pages
import { SuperAdminDashboardPage } from '@/pages/super-admin/DashboardPage';
import { StudentManagementPage } from '@/pages/super-admin/StudentManagementPage';
import { AdminManagementPage } from '@/pages/super-admin/AdminManagementPage';
import { ProgramManagementPage } from '@/pages/super-admin/ProgramManagementPage';
import { CourseManagementPage } from '@/pages/super-admin/CourseManagementPage';
import { SuperAdminSessionsPage } from '@/pages/super-admin/SessionsPage';
import { PromotionsPage } from '@/pages/super-admin/PromotionsPage';
import { AttendancePage } from '@/pages/super-admin/AttendancePage';
import { NotificationsPage } from '@/pages/super-admin/NotificationsPage';
import { AuditLogPage } from '@/pages/super-admin/AuditLogPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <PublicRoute><LoginPage /></PublicRoute>,
      },
      {
        path: 'login',
        element: <PublicRoute><LoginPage /></PublicRoute>,
      },
      {
        path: 'register',
        element: <PublicRoute><RegisterPage /></PublicRoute>,
      },
      {
        path: 'forgot-password',
        element: <PublicRoute><ForgotPasswordPage /></PublicRoute>,
      },
      {
        path: 'super-admin/register',
        element: <PublicRoute><SuperAdminRegisterPage /></PublicRoute>,
      },
    ],
  },
  {
    path: '/',
    element: <RouteGuard><DashboardLayout /></RouteGuard>,
    children: [
      // Student Routes
      { path: 'dashboard', element: <StudentDashboardPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'mark-attendance', element: <MarkAttendancePage /> },
      { path: 'records', element: <RecordsPage /> },
      { path: 'courses', element: <CoursesPage /> },

      // Admin Routes
      { path: 'admin/dashboard', element: <RouteGuard roles={['admin', 'super_admin']}><AdminDashboardPage /></RouteGuard> },
      { path: 'admin/generate-session', element: <RouteGuard roles={['admin', 'super_admin']}><GenerateSessionPage /></RouteGuard> },
      { path: 'admin/sessions', element: <RouteGuard roles={['admin', 'super_admin']}><SessionManagementPage /></RouteGuard> },
      { path: 'admin/attendance', element: <RouteGuard roles={['admin', 'super_admin']}><AttendanceTrackingPage /></RouteGuard> },
      { path: 'admin/courses', element: <RouteGuard roles={['admin', 'super_admin']}><AdminCoursesPage /></RouteGuard> },
      { path: 'admin/analytics', element: <RouteGuard roles={['admin', 'super_admin']}><AdminAnalyticsPage /></RouteGuard> },
    ],
  },
  {
    path: '/super-admin',
    element: <RouteGuard roles={['super_admin']}><SuperAdminLayout /></RouteGuard>,
    children: [
      { index: true, element: <SuperAdminDashboardPage /> },
      { path: 'students', element: <StudentManagementPage /> },
      { path: 'admins', element: <AdminManagementPage /> },
      { path: 'programs', element: <ProgramManagementPage /> },
      { path: 'courses', element: <CourseManagementPage /> },
      { path: 'sessions', element: <SuperAdminSessionsPage /> },
      { path: 'promotions', element: <PromotionsPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'audit', element: <AuditLogPage /> },
    ],
  },
]);
