import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, QrCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { sessionService } from '@/services/sessionService';
import { exportToCSV } from '@/utils/export';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export function SuperAdminSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionService.getSessions()
      .then(setSessions)
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'title', header: 'Title', render: (item: any) => (
      <span className="font-medium">{item.title}</span>
    )},
    { key: 'courses', header: 'Course', render: (item: any) => item.courses?.title || 'N/A' },
    { key: 'session_date', header: 'Date', render: (item: any) => (
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400" />
        {new Date(item.session_date).toLocaleDateString()}
      </div>
    )},
    { key: 'time', header: 'Time', render: (item: any) => (
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        {item.start_time} - {item.end_time}
      </div>
    )},
    { key: 'attendance_code', header: 'Code', render: (item: any) => (
      <code className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono">{item.attendance_code}</code>
    )},
    { key: 'is_active', header: 'Status', render: (item: any) => (
      <Badge variant={item.is_active ? 'success' : 'outline'}>
        {item.is_active ? 'Active' : 'Ended'}
      </Badge>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Sessions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{sessions.length} total sessions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (sessions.length === 0) return;
          exportToCSV(sessions.map((s) => ({
            Title: s.title,
            Course: s.courses?.title,
            Date: new Date(s.session_date).toLocaleDateString(),
            'Start Time': s.start_time,
            'End Time': s.end_time,
            Code: s.attendance_code,
            Status: s.is_active ? 'Active' : 'Ended',
          })), 'all-sessions');
          toast.success('CSV exported');
        }}>Export CSV</Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable columns={columns} data={sessions} searchPlaceholder="Search sessions..." />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
