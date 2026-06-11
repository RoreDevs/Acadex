import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { notificationService } from '@/services/notificationService';

export function TopBar() {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    notificationService.getUnreadCount(user.id).then(setUnreadCount);
    const interval = setInterval(() => {
      notificationService.getUnreadCount(user.id).then(setUnreadCount);
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const notifPath = profile?.role === 'super_admin' ? '/super-admin/notifications' : '/notifications';

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 px-6">
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Link to={notifPath}>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>
      </motion.div>

      <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.full_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile?.role?.replace('_', ' ')}</p>
        </div>
        <Avatar className="w-9 h-9 ring-2 ring-gray-100 dark:ring-gray-700">
          <AvatarFallback className="bg-primary-500 text-white text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
