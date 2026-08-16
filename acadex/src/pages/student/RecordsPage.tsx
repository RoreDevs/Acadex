import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Filter, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendanceService';
import { exportToPDF, exportToCSV } from '@/utils/export';
import toast from 'react-hot-toast';

export function RecordsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    attendanceService.getAttendanceByStudent(profile.id)
      .then(setRecords)
      .catch(() => toast.error('Failed to load records'))
      .finally(() => setLoading(false));
  }, [profile]);

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{new Date(item.sessions?.session_date || item.timestamp).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course',
      render: (item: any) => (
        <span className="font-medium">{item.sessions?.courses?.title || 'N/A'}</span>
      ),
    },
    {
      key: 'session',
      header: 'Session',
      render: (item: any) => (
        <span>{item.sessions?.title || 'N/A'}</span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: any) => {
        const meta: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' | 'outline' }> = {
          present: { label: 'Present', variant: 'success' },
          late: { label: 'Late', variant: 'warning' },
          absent: { label: 'Absent', variant: 'danger' },
          excused: { label: 'Excused', variant: 'default' },
        };
        const m = meta[item.status] || { label: item.status || 'Present', variant: 'outline' as const };
        return (
          <Badge variant={m.variant}>
            {m.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Records</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View your attendance history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (records.length === 0) { toast.error('No records to export'); return; }
            exportToCSV(
              records.map((r) => ({
                Date: new Date(r.sessions?.session_date || r.timestamp).toLocaleDateString(),
                Course: r.sessions?.courses?.title || 'N/A',
                Session: r.sessions?.title || 'N/A',
                Time: new Date(r.timestamp).toLocaleTimeString(),
                Status: r.status || 'Present',
              })),
              'attendance-records'
            );
            toast.success('CSV exported');
          }}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (records.length === 0) { toast.error('No records to export'); return; }
            exportToPDF(
              records.map((r) => ({
                Date: new Date(r.sessions?.session_date || r.timestamp).toLocaleDateString(),
                Course: r.sessions?.courses?.title || 'N/A',
                Session: r.sessions?.title || 'N/A',
                Time: new Date(r.timestamp).toLocaleTimeString(),
                Status: r.status || 'Present',
              })),
              'attendance-records',
              'My Attendance Records',
              ['Date', 'Course', 'Session', 'Time', 'Status']
            );
            toast.success('PDF exported');
          }}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={records}
              searchPlaceholder="Search by course or session..."
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
