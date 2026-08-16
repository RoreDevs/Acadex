import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AttendanceRateBarProps {
  rate: number | null;
  threshold: number;
  showLabel?: boolean;
  className?: string;
}

function rateColor(rate: number | null, threshold: number) {
  if (rate === null) return 'bg-gray-300 dark:bg-gray-600';
  if (rate >= threshold) return 'bg-green-500';
  if (rate >= threshold - 10) return 'bg-amber-500';
  return 'bg-red-500';
}

export function AttendanceRateBar({ rate, threshold, showLabel = true, className }: AttendanceRateBarProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Attendance rate</span>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              rate === null
                ? 'text-gray-400'
                : rate >= threshold
                  ? 'text-green-600 dark:text-green-400'
                  : rate >= threshold - 10
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
            )}
          >
            {rate === null ? 'No sessions yet' : `${rate}%`}
          </span>
        </div>
      )}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${rate ?? 0}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', rateColor(rate, threshold))}
        />
      </div>
    </div>
  );
}

export function RateBadge({ rate, threshold }: { rate: number | null; threshold: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums',
        rate === null
          ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
          : rate >= threshold
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : rate >= threshold - 10
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      )}
    >
      {rate === null ? 'N/A' : `${rate}%`}
    </span>
  );
}
