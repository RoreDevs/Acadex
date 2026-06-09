import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  delay?: number;
}

export function StatsCard({ title, value, icon, description, trend, className, delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-card hover:shadow-card-hover transition-all duration-200 p-6',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {description && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1">
              <span className={cn(
                'text-xs font-medium',
                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">vs last month</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-500 shrink-0">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
