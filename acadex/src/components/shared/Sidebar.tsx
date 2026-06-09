import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, User, QrCode, ClipboardList, BookOpen,
  LogOut, Menu, X, ChevronLeft, GraduationCap, Shield,
  Users, Calendar, Settings, BarChart3, Globe, Bell,
  Layers, FileText, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Role } from '@/types';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  roles?: Role[];
}

interface SidebarProps {
  role: Role;
  isAdminView?: boolean;
  onToggleView?: () => void;
}

export function Sidebar({ role, isAdminView, onToggleView }: SidebarProps) {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const studentNavItems: NavItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/dashboard' },
    { label: 'Profile', icon: <User className="w-5 h-5" />, href: '/profile' },
    { label: 'Mark Attendance', icon: <QrCode className="w-5 h-5" />, href: '/mark-attendance' },
    { label: 'Records', icon: <ClipboardList className="w-5 h-5" />, href: '/records' },
    { label: 'Courses', icon: <BookOpen className="w-5 h-5" />, href: '/courses' },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/admin/dashboard' },
    { label: 'Sessions', icon: <Calendar className="w-5 h-5" />, href: '/admin/sessions' },
    { label: 'Generate Session', icon: <QrCode className="w-5 h-5" />, href: '/admin/generate-session' },
    { label: 'Attendance', icon: <ClipboardList className="w-5 h-5" />, href: '/admin/attendance' },
    { label: 'Courses', icon: <BookOpen className="w-5 h-5" />, href: '/admin/courses' },
    { label: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, href: '/admin/analytics' },
  ];

  const superAdminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/super-admin' },
    { label: 'Students', icon: <Users className="w-5 h-5" />, href: '/super-admin/students' },
    { label: 'Admins', icon: <Shield className="w-5 h-5" />, href: '/super-admin/admins' },
    { label: 'Programs', icon: <Layers className="w-5 h-5" />, href: '/super-admin/programs' },
    { label: 'Courses', icon: <BookOpen className="w-5 h-5" />, href: '/super-admin/courses' },
    { label: 'Sessions', icon: <Calendar className="w-5 h-5" />, href: '/super-admin/sessions' },
    { label: 'Attendance', icon: <ClipboardList className="w-5 h-5" />, href: '/super-admin/attendance' },
    { label: 'Promotions', icon: <Activity className="w-5 h-5" />, href: '/super-admin/promotions' },
    { label: 'Audit Logs', icon: <FileText className="w-5 h-5" />, href: '/super-admin/audit' },
    { label: 'Notifications', icon: <Bell className="w-5 h-5" />, href: '/super-admin/notifications' },
  ];

  const getNavItems = () => {
    if (role === 'super_admin') return superAdminNavItems;
    if (isAdminView) return adminNavItems;
    return studentNavItems;
  };

  const navItems = getNavItems();
  const sidebarWidth = collapsed ? 'w-20' : 'w-64';

  const sidebarContent = (
    <div className={cn(
      'h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
      collapsed ? 'w-20' : 'w-64'
    )}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 dark:border-gray-700">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-lg font-bold text-gray-900 dark:text-gray-100"
          >
            Acadex
          </motion.span>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className={cn('w-4 h-4 text-gray-400 transition-transform', collapsed && 'rotate-180')} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => isMobile && setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <span className={cn('shrink-0', isActive ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300')}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-700">
        {role === 'admin' && onToggleView && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mb-2"
            onClick={onToggleView}
          >
            {isAdminView ? (
              <><User className="w-4 h-4 mr-2" /> Student View</>
            ) : (
              <><Shield className="w-4 h-4 mr-2" /> Admin View</>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && 'Logout'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {isMobile && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-card"
        >
          <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      )}

      {isMobile ? (
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-64"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      ) : (
        <aside className={cn('hidden md:block h-screen sticky top-0', sidebarWidth)}>
          {sidebarContent}
        </aside>
      )}
    </>
  );
}
