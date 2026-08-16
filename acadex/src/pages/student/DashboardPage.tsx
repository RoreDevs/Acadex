import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, CheckCircle, Clock, TrendingUp, MapPin } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendanceService';
import { courseService } from '@/services/courseService';
import { sessionService } from '@/services/sessionService';
import { timetableService } from '@/services/timetableService';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { NextClassData } from '@/types';

export function StudentDashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ attendance_rate: 0, classes_attended: 0, total_courses: 0, total_sessions: 0 });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);
  const [nextClass, setNextClass] = useState<NextClassData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const fetchData = async () => {
      try {
        const [s, att, sessions, courses, nc] = await Promise.all([
          attendanceService.getStudentStats(profile.id).catch(() => ({ attendance_rate: 0, classes_attended: 0, total_courses: 0, total_sessions: 0 })),
          attendanceService.getAttendanceByStudent(profile.id).catch(() => []),
          sessionService.getUpcomingSessions(5).catch(() => []),
          courseService.getCoursesByProgram(profile.program!, profile.level!).catch(() => []),
          timetableService.getNextClass().catch(() => null),
        ]);
        setStats({ ...s, total_courses: courses.length });
        setRecentAttendance(att.slice(0, 5));
        setUpcomingSessions(sessions || []);
        setNextClass(nc);

        const trendMap: Record<string, number> = {};
        (att || []).forEach((a: any) => {
          const date = a.timestamp?.split('T')[0];
          if (date) trendMap[date] = (trendMap[date] || 0) + 1;
        });
        setTrendData(
          Object.entries(trendMap).slice(-14).map(([date, count]) => ({ date, count }))
        );
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Here's your attendance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Attendance Rate"
          value={`${stats.attendance_rate}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          trend={{ value: stats.attendance_rate > 75 ? 5 : -3, isPositive: stats.attendance_rate > 75 }}
          delay={0}
        />
        <StatsCard
          title="Classes Attended"
          value={stats.classes_attended}
          icon={<CheckCircle className="w-6 h-6" />}
          description={`Out of ${stats.total_sessions} sessions`}
          delay={0.1}
        />
        <StatsCard
          title="Total Courses"
          value={stats.total_courses}
          icon={<BookOpen className="w-6 h-6" />}
          delay={0.2}
        />
        <StatsCard
          title="Upcoming"
          value={upcomingSessions.length}
          icon={<Calendar className="w-6 h-6" />}
          delay={0.3}
        />
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
                  <Badge className="mt-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {nextClass.exception_type.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#1e3a5f" strokeWidth={2} dot={{ fill: '#1e3a5f' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No attendance data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAttendance.length > 0 ? (
              <div className="space-y-3">
                {recentAttendance.map((a: any, i: number) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {a.sessions?.title || 'Attendance'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {a.sessions?.courses?.title} • {new Date(a.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="success">Present</Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {upcomingSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingSessions.map((s: any) => (
                <div key={s.id} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.courses?.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(s.session_date).toLocaleDateString()} • {s.start_time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
