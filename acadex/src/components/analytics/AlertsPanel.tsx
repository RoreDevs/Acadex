import { motion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import type { AnalyticsAlert } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AlertsPanelProps {
  alerts: AnalyticsAlert[];
  title?: string;
}

export function AlertsPanel({ alerts, title = 'Alerts & Insights' }: AlertsPanelProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No issues detected. Everything looks good.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          {title}
          <span className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-semibold">
            {alerts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, i) => (
          <motion.div
            key={`${alert.type}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-sm',
              alert.severity === 'warning'
                ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200'
                : 'border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200'
            )}
          >
            {alert.severity === 'warning'
              ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="text-gray-700 dark:text-gray-300">{alert.message}</span>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
