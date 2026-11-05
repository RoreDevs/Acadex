import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { DashboardLayout, SuperAdminLayout, AuthLayout } from '@/layouts/DashboardLayout';
import { RouteGuard, PublicRoute } from '@/components/shared/RouteGuard';
import { LoadingScreen } from '@/components/shared/LoadingScreen';

const lazyLoad = (importFn: () => Promise<any>, name: string) =>
  lazy(() => importFn().then(m => ({ default: m[name] })));

// Auth
const LoginPage = lazyLoad(() => import('@/pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = lazyLoad(() => import('@/pages/auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyLoad(() => import('@/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const SuperAdminRegisterPage = lazyLoad(() => import('@/pages/auth/SuperAdminRegisterPage'), 'SuperAdminRegisterPage');

// Student Pages
const StudentDashboardPage = lazyLoad(() => import('@/pages/student/DashboardPage'), 'StudentDashboardPage');
const ProfilePage = lazyLoad(() => import('@/pages/student/ProfilePage'), 'ProfilePage');
const MarkAttendancePage = lazyLoad(() => import('@/pages/student/MarkAttendancePage'), 'MarkAttendancePage');
const AttendanceLinkPage = lazyLoad(() => import('@/pages/student/AttendanceLinkPage'), 'AttendanceLinkPage');
const RecordsPage = lazyLoad(() => import('@/pages/student/RecordsPage'), 'RecordsPage');
const StudentAnalyticsPage = lazyLoad(() => import('@/pages/student/AnalyticsPage'), 'StudentAnalyticsPage');
const CoursesPage = lazyLoad(() => import('@/pages/student/CoursesPage'), 'CoursesPage');
const StudentNotificationsPage = lazyLoad(() => import('@/pages/student/NotificationsPage'), 'NotificationsPage');

// Admin Pages
const AdminDashboardPage = lazyLoad(() => import('@/pages/admin/DashboardPage'), 'AdminDashboardPage');
const GenerateSessionPage = lazyLoad(() => import('@/pages/admin/GenerateSessionPage'), 'GenerateSessionPage');
const SessionManagementPage = lazyLoad(() => import('@/pages/admin/SessionManagementPage'), 'SessionManagementPage');
const AttendanceTrackingPage = lazyLoad(() => import('@/pages/admin/AttendanceTrackingPage'), 'AttendanceTrackingPage');
const AdminCoursesPage = lazyLoad(() => import('@/pages/admin/CoursesPage'), 'AdminCoursesPage');
const AdminAnalyticsPage = lazyLoad(() => import('@/pages/admin/AnalyticsPage'), 'AdminAnalyticsPage');
const AdminStudentsPage = lazyLoad(() => import('@/pages/admin/StudentsPage'), 'AdminStudentsPage');

// Super Admin Pages
const SuperAdminDashboardPage = lazyLoad(() => import('@/pages/super-admin/DashboardPage'), 'SuperAdminDashboardPage');
const StudentManagementPage = lazyLoad(() => import('@/pages/super-admin/StudentManagementPage'), 'StudentManagementPage');
const AdminManagementPage = lazyLoad(() => import('@/pages/super-admin/AdminManagementPage'), 'AdminManagementPage');
const ProgramManagementPage = lazyLoad(() => import('@/pages/super-admin/ProgramManagementPage'), 'ProgramManagementPage');
const CourseManagementPage = lazyLoad(() => import('@/pages/super-admin/CourseManagementPage'), 'CourseManagementPage');
const CurriculumPage = lazyLoad(() => import('@/pages/super-admin/CurriculumPage'), 'CurriculumPage');
const SuperAdminSessionsPage = lazyLoad(() => import('@/pages/super-admin/SessionsPage'), 'SuperAdminSessionsPage');
const PromotionsPage = lazyLoad(() => import('@/pages/super-admin/PromotionsPage'), 'PromotionsPage');
const AttendancePage = lazyLoad(() => import('@/pages/super-admin/AttendancePage'), 'AttendancePage');
const SuperAdminNotificationsPage = lazyLoad(() => import('@/pages/super-admin/NotificationsPage'), 'NotificationsPage');
const AuditLogPage = lazyLoad(() => import('@/pages/super-admin/AuditLogPage'), 'AuditLogPage');
const AcademicPeriodsPage = lazyLoad(() => import('@/pages/super-admin/AcademicPeriodsPage'), 'AcademicPeriodsPage');
const SuperAdminAnalyticsPage = lazyLoad(() => import('@/pages/super-admin/AnalyticsPage'), 'SuperAdminAnalyticsPage');

const S = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<LoadingScreen />}><Component /></Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { index: true, element: <PublicRoute>{S(LoginPage)}</PublicRoute> },
      { path: 'login', element: <PublicRoute>{S(LoginPage)}</PublicRoute> },
      { path: 'register', element: <PublicRoute>{S(RegisterPage)}</PublicRoute> },
      { path: 'forgot-password', element: <PublicRoute>{S(ForgotPasswordPage)}</PublicRoute> },
      { path: 'super-admin/register', element: <PublicRoute>{S(SuperAdminRegisterPage)}</PublicRoute> },
    ],
  },
  {
    path: '/',
    element: <RouteGuard><DashboardLayout /></RouteGuard>,
    children: [
      { path: 'dashboard', element: S(StudentDashboardPage) },
      { path: 'profile', element: S(ProfilePage) },
      { path: 'mark-attendance', element: S(MarkAttendancePage) },
      { path: 'attendance/:code', element: S(AttendanceLinkPage) },
      { path: 'records', element: S(RecordsPage) },
      { path: 'analytics', element: S(StudentAnalyticsPage) },
      { path: 'courses', element: S(CoursesPage) },
      { path: 'notifications', element: S(StudentNotificationsPage) },
      { path: 'admin/dashboard', element: <RouteGuard roles={['admin', 'super_admin']}>{S(AdminDashboardPage)}</RouteGuard> },
      { path: 'admin/generate-session', element: <RouteGuard roles={['admin', 'super_admin']}>{S(GenerateSessionPage)}</RouteGuard> },
      { path: 'admin/sessions', element: <RouteGuard roles={['admin', 'super_admin']}>{S(SessionManagementPage)}</RouteGuard> },
      { path: 'admin/attendance', element: <RouteGuard roles={['admin', 'super_admin']}>{S(AttendanceTrackingPage)}</RouteGuard> },
      { path: 'admin/courses', element: <RouteGuard roles={['admin', 'super_admin']}>{S(AdminCoursesPage)}</RouteGuard> },
      { path: 'admin/analytics', element: <RouteGuard roles={['admin', 'super_admin']}>{S(AdminAnalyticsPage)}</RouteGuard> },
      { path: 'admin/students', element: <RouteGuard roles={['admin', 'super_admin']}>{S(AdminStudentsPage)}</RouteGuard> },
    ],
  },
  {
    path: '/super-admin',
    element: <RouteGuard roles={['super_admin']}><SuperAdminLayout /></RouteGuard>,
    children: [
      { index: true, element: S(SuperAdminDashboardPage) },
      { path: 'students', element: S(StudentManagementPage) },
      { path: 'admins', element: S(AdminManagementPage) },
      { path: 'programs', element: S(ProgramManagementPage) },
      { path: 'courses', element: S(CourseManagementPage) },
      { path: 'curriculum', element: S(CurriculumPage) },
      { path: 'sessions', element: S(SuperAdminSessionsPage) },
      { path: 'promotions', element: S(PromotionsPage) },
      { path: 'attendance', element: S(AttendancePage) },
      { path: 'notifications', element: S(SuperAdminNotificationsPage) },
      { path: 'audit', element: S(AuditLogPage) },
      { path: 'academic', element: S(AcademicPeriodsPage) },
      { path: 'analytics', element: S(SuperAdminAnalyticsPage) },
    ],
  },
]);
