import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/DataTable';
import { auditService } from '@/services/auditService';
import { exportToCSV } from '@/utils/export';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditService.getLogs()
      .then(setLogs)
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'user_name', header: 'User', render: (item: any) => (
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-gray-400" />
        <span className="font-medium">{item.user_name}</span>
      </div>
    )},
    { key: 'action', header: 'Action', render: (item: any) => (
      <span className="font-medium text-primary-500">{item.action}</span>
    )},
    { key: 'details', header: 'Details', render: (item: any) => (
      <span className="text-gray-500">{item.details || '-'}</span>
    )},
    { key: 'created_at', header: 'Timestamp', render: (item: any) => (
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <span>{new Date(item.created_at).toLocaleString()}</span>
      </div>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track all admin and super admin actions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (logs.length === 0) return;
          exportToCSV(logs.map((l) => ({
            User: l.user_name,
            Action: l.action,
            Details: l.details || '',
            Timestamp: new Date(l.created_at).toLocaleString(),
          })), 'audit-logs');
          toast.success('CSV exported');
        }}>
          <FileText className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
              data={logs}
              searchPlaceholder="Search by user, action, or details..."
              pageSize={20}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
