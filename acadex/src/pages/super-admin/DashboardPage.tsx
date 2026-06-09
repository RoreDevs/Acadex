import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Layers, BookOpen, Calendar, ClipboardList } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardService } from '@/services/dashboardService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { DashboardStats } from '@/types';

export function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_students: 0,
    total_admins: 0,
    total_sessions: 0,
    active_sessions: 0,
    total_courses: 0,
    total_programs: 0,
    attendance_rate: 0,
    total_attendance: 0,
  });
  const [trends, setTrends] = useState<{ date: string; count: number }[]>([]);
  const [programData, setProgramData] = useState<{ name: string; attendance: number }[]>([]);

  useEffect(() => {
    dashboardService.getSuperAdminStats().then(setStats);
    dashboardService.getAttendanceTrends(14).then(setTrends);
    dashboardService.getProgramAttendanceComparison().then(setProgramData);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Super Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Full system overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Students" value={stats.total_students} icon={<Users className="w-5 h-5" />} delay={0} />
        <StatsCard title="Admins" value={stats.total_admins} icon={<Shield className="w-5 h-5" />} delay={0.05} />
        <StatsCard title="Programs" value={stats.total_programs} icon={<Layers className="w-5 h-5" />} delay={0.1} />
        <StatsCard title="Courses" value={stats.total_courses} icon={<BookOpen className="w-5 h-5" />} delay={0.15} />
        <StatsCard title="Sessions" value={stats.total_sessions} icon={<Calendar className="w-5 h-5" />} delay={0.2} />
        <StatsCard title="Attendance" value={stats.total_attendance} icon={<ClipboardList className="w-5 h-5" />} delay={0.25} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {programData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={programData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="#9ca3af" width={120} />
                  <Tooltip />
                  <Bar dataKey="attendance" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
