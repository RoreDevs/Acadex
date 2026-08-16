import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, PlayCircle, TrendingUp, BookOpen, QrCode, Clock, MapPin } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboardService';
import { timetableService } from '@/services/timetableService';
import { useProgramName } from '@/hooks/useProgramName';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { NextClassData } from '@/types';

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
  const [nextClass, setNextClass] = useState<NextClassData | null>(null);

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
        timetableService.getNextClass().then(nc => setNextClass(nc)).catch(() => {});
      } catch (err) {
        console.error('Failed to load admin dashboard', err);
      }
    };
    fetchData();
  }, [profile]);

  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

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

      {nextClass && (
        <Card className="border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary-600 dark:text-primary-400">Next Class</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {nextClass.course_code} — {nextClass.course_title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(nextClass.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  {' • '}
                  {formatTime(nextClass.start_time)} – {formatTime(nextClass.end_time)}
                  {nextClass.venue && (
                    <span className="inline-flex items-center gap-1 ml-1">
                      <MapPin className="w-3 h-3" />{nextClass.venue}
                    </span>
                  )}
                </p>
                {nextClass.exception_type !== 'REGULAR' && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {nextClass.exception_type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
