import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CalendarCheck, Users, BookOpen, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/shared/StatsCard';
import { DataTable } from '@/components/shared/DataTable';
import { AnalyticsFilters, type FilterOption } from '@/components/analytics/AnalyticsFilters';
import { TrendChart } from '@/components/analytics/TrendChart';
import { RateBadge } from '@/components/analytics/AttendanceRateBar';
import { academicPeriodService } from '@/services/academicPeriodService';
import { analyticsService } from '@/services/analyticsService';
import { exportToCSV } from '@/utils/export';
import type { SuperAdminAnalytics } from '@/types';
import toast from 'react-hot-toast';

export function SuperAdminAnalyticsPage() {
  const [semesters, setSemesters] = useState<FilterOption[]>([]);
  const [semesterValue, setSemesterValue] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<SuperAdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    academicPeriodService.getYears().then((years) => {
      const flat = (years || []).flatMap((y) =>
        (y.semesters || []).map((s) => ({ id: s.id, label: `${y.name} • ${s.name}` }))
      );
      setSemesters(flat);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    analyticsService.getSuperAdminAnalytics(
      semesterValue === 'all' ? undefined : semesterValue,
      startDate || undefined,
      endDate || undefined
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
  }, [semesterValue, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const programColumns = [
    {
      key: 'name',
      header: 'Program',
      render: (item: any) => (
        <div>
          <span className="font-medium">{item.name}</span>
          <span className="ml-2 text-gray-400">{item.code}</span>
        </div>
      ),
    },
    { key: 'students', header: 'Students', render: (item: any) => item.students },
    { key: 'held', header: 'Sessions', render: (item: any) => item.held },
    { key: 'attended', header: 'Attended', render: (item: any) => item.attended },
    {
      key: 'rate',
      header: 'Rate',
      render: (item: any) => (data ? <RateBadge rate={item.rate} threshold={data.threshold} /> : item.rate),
    },
  ];

  const levelColumns = [
    { key: 'level', header: 'Level', render: (item: any) => <span className="font-medium">{item.level || 'N/A'}</span> },
    { key: 'students', header: 'Students', render: (item: any) => item.students },
    { key: 'held', header: 'Sessions', render: (item: any) => item.held },
    { key: 'attended', header: 'Attended', render: (item: any) => item.attended },
    {
      key: 'rate',
      header: 'Rate',
      render: (item: any) => (data ? <RateBadge rate={item.rate} threshold={data.threshold} /> : item.rate),
    },
  ];

  const courseColumns = [
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
    { key: 'program_name', header: 'Program', render: (item: any) => item.program_name },
    { key: 'held', header: 'Sessions', render: (item: any) => item.held },
    { key: 'attended', header: 'Attended', render: (item: any) => item.attended },
    {
      key: 'rate',
      header: 'Rate',
      render: (item: any) => (data ? <RateBadge rate={item.rate} threshold={data.threshold} /> : item.rate),
    },
  ];

  const semesterColumns = [
    {
      key: 'name',
      header: 'Semester',
      render: (item: any) => (
        <div>
          <span className="font-medium">{item.name || 'Not assigned'}</span>
          {item.year_name && <span className="ml-2 text-gray-400">{item.year_name}</span>}
        </div>
      ),
    },
    { key: 'held', header: 'Sessions', render: (item: any) => item.held },
    { key: 'attended', header: 'Attended', render: (item: any) => item.attended },
    {
      key: 'rate',
      header: 'Rate',
      render: (item: any) => (data ? <RateBadge rate={item.rate} threshold={data.threshold} /> : item.rate),
    },
  ];

  const recentColumns = [
    {
      key: 'session_date',
      header: 'Date',
      render: (item: any) => new Date(item.session_date).toLocaleDateString(),
    },
    { key: 'program_name', header: 'Program', render: (item: any) => item.program_name },
    {
      key: 'course',
      header: 'Course',
      render: (item: any) => <span className="font-medium">{item.course_title}</span>,
    },
    { key: 'present', header: 'Present', render: (item: any) => item.present },
    { key: 'late', header: 'Late', render: (item: any) => item.late },
    { key: 'absent', header: 'Absent', render: (item: any) => item.absent },
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">System-wide attendance insights</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (!data || data.by_course.length === 0) { toast.error('No course data to export'); return; }
          exportToCSV(data.by_course.map((c) => ({
            Code: c.code,
            Course: c.title,
            Program: c.program_name,
            Sessions: c.held,
            Attended: c.attended,
            Rate: c.rate,
          })), 'system-attendance-by-course');
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
        showDateRange
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
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
              value={data.totals.rate === null ? '—' : `${data.totals.rate}%`}
              icon={<TrendingUp className="w-6 h-6" />}
              description={`Threshold: ${data.threshold}%`}
              delay={0}
            />
            <StatsCard
              title="Held Sessions"
              value={data.totals.held}
              icon={<CalendarCheck className="w-6 h-6" />}
              description={`${data.totals.attended} of ${data.totals.possible} possible marks`}
              delay={0.05}
            />
            <StatsCard
              title="Students"
              value={data.totals.students ?? 0}
              icon={<Users className="w-6 h-6" />}
              description="Registered students"
              delay={0.1}
            />
            <StatsCard
              title="Courses Tracked"
              value={data.by_course.length}
              icon={<BookOpen className="w-6 h-6" />}
              description="Courses with held sessions"
              delay={0.15}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly Attendance Trend (12 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={data.trend} height={300} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance by Program</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_program.length > 0 ? (
                  <DataTable columns={programColumns} data={data.by_program} searchable={false} pageSize={8} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No program data available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance by Level</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_level.length > 0 ? (
                  <DataTable columns={levelColumns} data={data.by_level} searchable={false} pageSize={8} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No level data available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance by Course</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_course.length > 0 ? (
                  <DataTable columns={courseColumns} data={data.by_course} searchable searchPlaceholder="Search courses..." pageSize={8} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No course data available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance by Semester</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_semester.length > 0 ? (
                  <DataTable columns={semesterColumns} data={data.by_semester} searchable={false} pageSize={8} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No semester data available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent.length > 0 ? (
                <DataTable columns={recentColumns} data={data.recent} searchable={false} pageSize={8} />
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent sessions.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
