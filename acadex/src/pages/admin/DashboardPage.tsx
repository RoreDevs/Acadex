import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, PlayCircle, TrendingUp, BookOpen, QrCode, Search, ArrowRightLeft } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboardService';
import { profileService } from '@/services/profileService';
import { useProgramName } from '@/hooks/useProgramName';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const INITIAL_CLASS_A: string[] = [
  "B202250058",
];

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
  const [csStudents, setCsStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  const [customClassMap, setCustomClassMap] = useState<Record<string, 'A' | 'B'>>({});
  const [search, setSearch] = useState('');

  const isBtechCSLevel100 = programName === 'BTECH COMPUTER SCIENCE' && profile?.level === 'Level 100';

  useEffect(() => {
    if (!profile?.id) return;
    try {
      const saved = localStorage.getItem(`classMap_${profile.id}`);
      if (saved) setCustomClassMap(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    try { localStorage.setItem(`classMap_${profile.id}`, JSON.stringify(customClassMap)); }
    catch { /* ignore */ }
  }, [customClassMap, profile?.id]);

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

  useEffect(() => {
    if (!isBtechCSLevel100 || !profile?.program || !profile?.level) return;
    profileService.getStudentsByProgram(profile.program, profile.level)
      .then(setCsStudents)
      .catch(() => toast.error('Failed to load students'));
  }, [isBtechCSLevel100, profile?.program, profile?.level]);

  const { classA, classB } = useMemo(() => {
    if (!isBtechCSLevel100) return { classA: [] as any[], classB: [] as any[] };
    const a: any[] = [];
    const b: any[] = [];
    for (const s of csStudents) {
      const override = customClassMap[s.index_number];
      if (override) {
        (override === 'A' ? a : b).push(s);
      } else if (INITIAL_CLASS_A.includes(s.index_number)) {
        a.push(s);
      } else {
        b.push(s);
      }
    }
    return { classA: a, classB: b };
  }, [csStudents, customClassMap, isBtechCSLevel100]);

  const moveStudent = (index: string, to: 'A' | 'B') => {
    setCustomClassMap((prev) => ({ ...prev, [index]: to }));
  };

  const currentList = activeTab === 'A' ? classA : classB;

  const filtered = currentList.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.index_number?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {programName} - {profile?.level}
          {isBtechCSLevel100 && ` • Class ${activeTab} (${currentList.length} students)`}
        </p>
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

      {isBtechCSLevel100 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-2 mb-4">
              <Button
                variant={activeTab === 'A' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('A')}
              >
                Class A ({classA.length})
              </Button>
              <Button
                variant={activeTab === 'B' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('B')}
              >
                Class B ({classB.length})
              </Button>
            </div>

            <div className="mb-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Active Class Functions ({activeTab})
              </p>
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => toast.success(`Attendance code generated for Class ${activeTab}`)}
              >
                <QrCode className="w-4 h-4 mr-2" />
                Generate Attendance Code for Class {activeTab}
              </Button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, index, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Users className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                <p>{search ? 'No students match your search.' : `No students in Class ${activeTab}.`}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Index Number</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Email</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Level</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-2 font-medium text-gray-900 dark:text-gray-100">{s.full_name}</td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.index_number}</td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.email}</td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.level}</td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveStudent(s.index_number, activeTab === 'A' ? 'B' : 'A')}
                            className={
                              activeTab === 'A'
                                ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                                : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                            }
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                            Move to {activeTab === 'A' ? 'B' : 'A'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
