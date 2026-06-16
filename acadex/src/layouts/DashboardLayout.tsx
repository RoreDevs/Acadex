import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopBar } from '@/components/shared/TopBar';
import { PasswordResetDialog } from '@/components/shared/PasswordResetDialog';
import { useAuth } from '@/contexts/AuthContext';

export function DashboardLayout() {
  const { profile, recovering, clearRecovery } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdminView, setIsAdminView] = useState(() => location.pathname.startsWith('/admin'));

  const toggleView = () => {
    const switchingToAdmin = !isAdminView;
    setIsAdminView(switchingToAdmin);
    if (switchingToAdmin) {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <PasswordResetDialog open={recovering} onClose={clearRecovery} />
      <Sidebar
        role={profile?.role || 'student'}
        isAdminView={isAdminView}
        onToggleView={profile?.role === 'admin' ? toggleView : undefined}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}

export function SuperAdminLayout() {
  const { profile, recovering, clearRecovery } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <PasswordResetDialog open={recovering} onClose={clearRecovery} />
      <Sidebar role={profile?.role || 'super_admin'} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Outlet />
    </div>
  );
}
