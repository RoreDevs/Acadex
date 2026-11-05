import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, PlayCircle, TrendingUp, BookOpen, QrCode } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboardService';
import { useProgramName } from '@/hooks/useProgramName';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export function AdminDashboardPage() {
  const { profile } = useAuth();
  const programName = useProgramName(profile?.program);
  const [stats, setStats] = useState({
    total_students: 0,
    total_sessions: 0,
    active_sessions: 0,
    total_courses: 0,
    attendance_rate: 0,
    total_attendance: 0,
  });
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    const fetchData = async () => {
      try {
        const [s, trends] = await Promise.all([
          dashboardService.getAdminStats(profile.program!, profile.level!),
          dashboardService.getAttendanceTrends(14),
        ]);
        setStats(s);
        setTrendData(trends);
      } catch (err) {
        console.error('Failed to load admin dashboard', err);
      }
    };
    fetchData();
  }, [profile]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{programName} - {profile?.level}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Total Students" value={stats.total_students} icon={<Users className="w-6 h-6" />} delay={0} />
        <StatsCard title="Sessions" value={stats.total_sessions} icon={<Calendar className="w-6 h-6" />} delay={0.1} />
        <StatsCard title="Active Sessions" value={stats.active_sessions} icon={<PlayCircle className="w-6 h-6" />} delay={0.2} />
        <StatsCard title="Courses" value={stats.total_courses} icon={<BookOpen className="w-6 h-6" />} delay={0.3} />
        <StatsCard title="Attendance Rate" value={`${stats.attendance_rate}%`} icon={<TrendingUp className="w-6 h-6" />} delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Generate Session</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create a new attendance session</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Track Attendance</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">View attendance records</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
