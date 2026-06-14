import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, User, QrCode, ClipboardList, BookOpen,
  LogOut, Menu, X, ChevronLeft, GraduationCap, Shield,
  Users, Calendar, Settings, BarChart3, Globe, Bell,
  Layers, FileText, Activity, Presentation, ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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
  const { signOut } = useAuth();
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
    { label: 'Slides', icon: <Presentation className="w-5 h-5" />, href: '/slides' },
    { label: 'Assignments', icon: <ListChecks className="w-5 h-5" />, href: '/assignments' },
    { label: 'Notifications', icon: <Bell className="w-5 h-5" />, href: '/notifications' },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/admin/dashboard' },
    { label: 'Students', icon: <Users className="w-5 h-5" />, href: '/admin/students' },
    { label: 'Sessions', icon: <Calendar className="w-5 h-5" />, href: '/admin/sessions' },
    { label: 'Generate Session', icon: <QrCode className="w-5 h-5" />, href: '/admin/generate-session' },
    { label: 'Attendance', icon: <ClipboardList className="w-5 h-5" />, href: '/admin/attendance' },
    { label: 'Courses', icon: <BookOpen className="w-5 h-5" />, href: '/admin/courses' },
    { label: 'Slides', icon: <Presentation className="w-5 h-5" />, href: '/admin/slides' },
    { label: 'Assignments', icon: <ListChecks className="w-5 h-5" />, href: '/admin/assignments' },
    { label: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, href: '/admin/analytics' },
    { label: 'Notifications', icon: <Bell className="w-5 h-5" />, href: '/notifications' },
  ];

  const superAdminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/super-admin' },
    { label: 'Students', icon: <Users className="w-5 h-5" />, href: '/super-admin/students' },
    { label: 'Admins', icon: <Shield className="w-5 h-5" />, href: '/super-admin/admins' },
    { label: 'Programs', icon: <Layers className="w-5 h-5" />, href: '/super-admin/programs' },
    { label: 'Courses', icon: <BookOpen className="w-5 h-5" />, href: '/super-admin/courses' },
    { label: 'Sessions', icon: <Calendar className="w-5 h-5" />, href: '/super-admin/sessions' },
    { label: 'Attendance', icon: <ClipboardList className="w-5 h-5" />, href: '/super-admin/attendance' },
    { label: 'Slides', icon: <Presentation className="w-5 h-5" />, href: '/super-admin/slides' },
    { label: 'Assignments', icon: <ListChecks className="w-5 h-5" />, href: '/super-admin/assignments' },
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

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    const link = (
      <Link
        to={item.href}
        onClick={() => isMobile && setOpen(false)}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
        )}
      >
        {isActive && (
          <motion.span
            layoutId="activeTab"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary-500"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className={cn(
          'shrink-0 transition-colors duration-200',
          isActive
            ? 'text-primary-500'
            : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
        )}>
          {item.icon}
        </span>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            {item.label}
          </motion.span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  const sidebarContent = (
    <div className={cn(
      'relative h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out',
      collapsed ? 'w-20' : 'w-64'
    )}>
      <div className="flex items-center h-16 border-b border-gray-100 dark:border-gray-700">
        <div className={cn(
          'flex items-center gap-3 transition-all duration-300',
          collapsed ? 'justify-center w-full px-0' : 'px-4'
        )}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shrink-0 shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap"
            >
              Acadex
            </motion.span>
          )}
        </div>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute -right-3 top-16 z-10 flex items-center justify-center w-6 h-6 rounded-full border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-600',
          collapsed && 'rotate-180'
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronLeft className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      </button>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <TooltipProvider>
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </TooltipProvider>
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
        {role === 'admin' && onToggleView && (
          <Button
            variant="outline"
            size={collapsed ? 'icon' : 'sm'}
            className={cn('w-full', collapsed ? 'h-9 w-9 mx-auto' : '')}
            onClick={onToggleView}
            title={isAdminView ? 'Switch to student view' : 'Switch to admin view'}
          >
            {collapsed ? (
              isAdminView ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />
            ) : (
              isAdminView ? <><User className="w-4 h-4 mr-2" /> Student View</> : <><Shield className="w-4 h-4 mr-2" /> Admin View</>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
            collapsed ? 'h-9 w-9 mx-auto' : ''
          )}
          onClick={signOut}
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {isMobile && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
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
        <aside className={cn(
          'hidden md:block h-screen sticky top-0 transition-all duration-300 ease-in-out',
          collapsed ? 'w-20' : 'w-64'
        )}>
          {sidebarContent}
        </aside>
      )}
    </TooltipProvider>
  );
}