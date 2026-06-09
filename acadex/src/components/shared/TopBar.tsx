import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

export function TopBar() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 px-6">
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
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
