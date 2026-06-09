import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { attendanceService } from '@/services/attendanceService';
import { exportToCSV, exportToExcel } from '@/utils/export';
import toast from 'react-hot-toast';

export function AttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceService.getAllAttendanceRecords()
      .then(setRecords)
      .catch(() => toast.error('Failed to load attendance records'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{item.profiles?.full_name || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'index',
      header: 'Index No.',
      render: (item: any) => item.profiles?.index_number || 'N/A',
    },
    {
      key: 'session',
      header: 'Session',
      render: (item: any) => item.sessions?.title || 'N/A',
    },
    {
      key: 'course',
      header: 'Course',
      render: (item: any) => item.sessions?.courses?.title || 'N/A',
    },
    {
      key: 'date',
      header: 'Date',
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          {new Date(item.timestamp).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          {new Date(item.timestamp).toLocaleTimeString()}
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Records</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{records.length} total records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (records.length === 0) return;
            exportToCSV(records.map((r) => ({
              Student: r.profiles?.full_name,
              'Index Number': r.profiles?.index_number,
              Session: r.sessions?.title,
              Course: r.sessions?.courses?.title,
              Date: new Date(r.timestamp).toLocaleDateString(),
              Time: new Date(r.timestamp).toLocaleTimeString(),
            })), 'attendance-records');
            toast.success('CSV exported');
          }}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (records.length === 0) return;
            exportToExcel(records.map((r) => ({
              Student: r.profiles?.full_name,
              'Index Number': r.profiles?.index_number,
              Session: r.sessions?.title,
              Course: r.sessions?.courses?.title,
              Date: new Date(r.timestamp).toLocaleDateString(),
              Time: new Date(r.timestamp).toLocaleTimeString(),
            })), 'attendance-records');
            toast.success('Excel exported');
          }}>
            <Download className="w-4 h-4 mr-2" />
            Excel
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
              searchPlaceholder="Search by student, session, or course..."
              pageSize={20}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
