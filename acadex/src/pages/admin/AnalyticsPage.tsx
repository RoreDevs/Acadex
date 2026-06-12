import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboardService';
import { attendanceService } from '@/services/attendanceService';
import { profileService } from '@/services/profileService';
import { sessionService } from '@/services/sessionService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#1e3a5f', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AdminAnalyticsPage() {
  const { profile } = useAuth();
  const [trends, setTrends] = useState<{ date: string; count: number }[]>([]);
  const [programData, setProgramData] = useState<{ name: string; attendance: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ name: string; present: number; absent: number }[]>([]);

  useEffect(() => {
    if (!profile?.program || !profile?.level) return;
    dashboardService.getAttendanceTrends(30).then(setTrends);
    dashboardService.getProgramAttendanceComparison().then(setProgramData);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    Promise.all([
      profileService.getStudentsByProgram(profile.program, profile.level),
      sessionService.getSessionsByProgram(profile.program, profile.level),
    ]).then(([students, sessions]) => {
      const monthSessions = (sessions || []).filter((s: any) => {
        const d = new Date(s.session_date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      const sessionIds = monthSessions.map((s: any) => s.id);
      if (sessionIds.length === 0) {
        setMonthlyData([{ name: 'This Month', present: 0, absent: 0 }]);
        return;
      }
      attendanceService.getAttendanceByDateRange(
        `${year}-${String(month).padStart(2, '0')}-01`,
        new Date(year, month, 0).toISOString().split('T')[0]
      ).then((records) => {
        const totalPresent = (records || []).filter((r: any) =>
          sessionIds.includes(r.session_id)
        ).length;
        const totalStudents = students?.length || 0;
        const totalPossible = totalStudents * sessionIds.length;
        setMonthlyData([{
          name: 'This Month',
          present: totalPresent,
          absent: Math.max(0, totalPossible - totalPresent),
        }]);
      });
    });
  }, [profile?.program, profile?.level]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Attendance analytics and insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trends (30 days)</CardTitle>
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
              <p className="text-gray-500 text-center py-8">No data available</p>
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
                <BarChart data={programData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Bar dataKey="attendance" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={[
                    { name: 'Present', value: monthlyData[0]?.present || 0 },
                    { name: 'Absent', value: monthlyData[0]?.absent || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {COLORS.slice(0, 2).map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center">
                <div className="text-6xl font-bold text-primary-500 mb-2">
                  {monthlyData.length > 0
                    ? Math.round((monthlyData[0].present / (monthlyData[0].present + monthlyData[0].absent)) * 100)
                    : 0}%
                </div>
                <p className="text-gray-500 dark:text-gray-400">Overall Attendance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
