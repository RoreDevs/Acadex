import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, CalendarX, TrendingUp, Award, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/shared/StatsCard';
import { DataTable } from '@/components/shared/DataTable';
import { AnalyticsFilters, type FilterOption } from '@/components/analytics/AnalyticsFilters';
import { TrendChart } from '@/components/analytics/TrendChart';
import { AlertsPanel } from '@/components/analytics/AlertsPanel';
import { RateBadge } from '@/components/analytics/AttendanceRateBar';
import { AttendanceStatusBadge } from '@/components/analytics/AttendanceStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { academicPeriodService } from '@/services/academicPeriodService';
import { courseService } from '@/services/courseService';
import { analyticsService } from '@/services/analyticsService';
import { exportToCSV } from '@/utils/export';
import type { AnalyticsAlert, StudentAnalytics } from '@/types';
import toast from 'react-hot-toast';

export function StudentAnalyticsPage() {
  const { profile } = useAuth();
  const [semesters, setSemesters] = useState<FilterOption[]>([]);
  const [courses, setCourses] = useState<FilterOption[]>([]);
  const [semesterValue, setSemesterValue] = useState('all');
  const [courseValue, setCourseValue] = useState('all');
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    academicPeriodService.getYears().then((years) => {
      const flat = (years || []).flatMap((y) =>
        (y.semesters || []).map((s) => ({ id: s.id, label: `${y.name} • ${s.name}` }))
      );
      setSemesters(flat);
    });
  }, []);

  useEffect(() => {
    if (!profile) return;
    courseService.getEnrollments(profile.id).then((enrollments) => {
      const list = (enrollments || [])
        .map((e: any) => e.courses)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, label: `${c.code} • ${c.title}` }));
      setCourses(list);
    });
  }, [profile]);

  const load = useCallback(() => {
    if (!profile) return;
    setLoading(true);
    analyticsService.getStudentAnalytics(
      semesterValue === 'all' ? undefined : semesterValue,
      courseValue === 'all' ? undefined : courseValue
    )
      .then((result) => {
        if (!result.success) {
          toast.error(result.message || 'Failed to load analytics');
          setData(null);
          return;
        }
        setData(result);
      })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [profile, semesterValue, courseValue]);

  useEffect(() => { load(); }, [load]);

  const alerts: AnalyticsAlert[] = [];
  if (data) {
    if (data.overall.rate !== null && data.overall.rate < data.threshold) {
      alerts.push({
        type: 'below_threshold',
        severity: 'warning',
        message: `Your overall attendance (${data.overall.rate}%) is below the ${data.threshold}% threshold.`,
      });
    }
    if (data.by_course.length > 0) {
      for (const c of data.by_course) {
        if (c.rate !== null && c.rate < data.threshold) {
          alerts.push({
            type: 'below_threshold',
            severity: 'warning',
            message: `Attendance in ${c.code} (${c.title}) is ${c.rate}%, below the ${data.threshold}% threshold.`,
          });
        }
      }
    }
    const w = data.windows;
    if (w?.recent?.rate !== null && w?.previous?.rate !== null && w?.recent?.rate !== undefined && w?.previous?.rate !== undefined) {
      const delta = w.recent.rate! - w.previous.rate!;
      if (delta <= -10) {
        alerts.push({
          type: 'decline',
          severity: 'info',
          delta: Math.round(delta * 10) / 10,
          message: `Your attendance rate dropped ${Math.abs(Math.round(delta * 10) / 10)} points over the last 5 sessions compared with the previous 5.`,
        });
      }
    }
  }

  const rateDelta = (() => {
    const w = data?.windows;
    if (!w?.recent || !w?.previous || w.recent.rate === null || w.recent.rate === undefined || w.previous.rate === null || w.previous.rate === undefined) return undefined;
    return Math.round((w.recent.rate - w.previous.rate) * 10) / 10;
  })();

  const bestCourse = data
    ? data.by_course.reduce<{ code: string; rate: number | null } | null>((best, c) => {
        if (c.rate === null) return best;
        if (!best || best.rate === null || c.rate > best.rate) return { code: c.code, rate: c.rate };
        return best;
      }, null)
    : null;

  const columns = [
    {
      key: 'code',
      header: 'Course',
      render: (item: any) => (
        <div>
          <span className="font-medium">{item.code}</span>
          <span className="ml-2 text-gray-400">{item.title}</span>
        </div>
      ),
    },
    {
      key: 'held',
      header: 'Sessions',
      render: (item: any) => item.held,
    },
    {
      key: 'attended',
      header: 'Attended',
      render: (item: any) => item.attended,
    },
    {
      key: 'missed',
      header: 'Missed',
      render: (item: any) => (item.absent || 0) + (item.not_marked || 0),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (item: any) => (data ? <RateBadge rate={item.rate} threshold={data.threshold} /> : item.rate),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Your attendance trends and insights</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (!data || !data.recent || data.recent.length === 0) { toast.error('No records to export'); return; }
          exportToCSV(data.recent.map((r) => ({
            Date: new Date(r.session_date).toLocaleDateString(),
            Course: r.course_title,
            Session: r.title,
            Status: r.status,
          })), 'my-attendance-analytics');
          toast.success('CSV exported');
        }}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <AnalyticsFilters
        semesters={semesters}
        semesterValue={semesterValue}
        onSemesterChange={setSemesterValue}
        courses={courses}
        courseValue={courseValue}
        onCourseChange={setCourseValue}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No attendance data found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Overall Attendance"
              value={data.overall.rate === null ? '—' : `${data.overall.rate}%`}
              icon={<TrendingUp className="w-6 h-6" />}
              trend={rateDelta === undefined ? undefined : { value: Math.abs(rateDelta), isPositive: rateDelta >= 0 }}
              description={`Threshold: ${data.threshold}%`}
              delay={0}
            />
            <StatsCard
              title="Sessions Attended"
              value={data.overall.attended}
              icon={<CalendarCheck className="w-6 h-6" />}
              description={`Out of ${data.overall.held} held sessions`}
              delay={0.05}
            />
            <StatsCard
              title="Sessions Missed"
              value={data.overall.missed}
              icon={<CalendarX className="w-6 h-6" />}
              description={`${data.overall.absent} absent, ${data.overall.not_marked} not marked`}
              delay={0.1}
            />
            <StatsCard
              title="Best Course"
              value={bestCourse?.code || '—'}
              icon={<Award className="w-6 h-6" />}
              description={bestCourse ? `Highest course attendance (${bestCourse.rate}%)` : 'No courses yet'}
              delay={0.15}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Trend (12 weeks)</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.trend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Trend (24 months)</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.trend_monthly} color="#8b5cf6" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Attendance by Course</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_course.length > 0 ? (
                  <DataTable
                    columns={columns}
                    data={data.by_course}
                    searchable={false}
                    pageSize={8}
                  />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No course data available.</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.last_5.length > 0 ? (
                    <div className="space-y-2">
                      {data.last_5.map((s) => (
                        <div key={s.session_id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                              {new Date(s.session_date).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-400">{s.start_time}</p>
                          </div>
                          <AttendanceStatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent sessions.</p>
                  )}
                </CardContent>
              </Card>

              <AlertsPanel alerts={alerts} />
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
