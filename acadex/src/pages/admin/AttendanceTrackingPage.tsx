import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Users, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { attendanceService } from '@/services/attendanceService';
import { sessionService } from '@/services/sessionService';
import { profileService } from '@/services/profileService';
import { courseService } from '@/services/courseService';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/export';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export function AttendanceTrackingPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    sessionService.getSessionsByProgram(profile.program!, profile.level!).then(setSessions);
    profileService.getStudentsByProgram(profile.program!, profile.level!).then(setStudents);
    courseService.getCoursesByProgram(profile.program!, profile.level!).then(setCourses);
  }, [profile]);

  const loadAttendance = async (sessionId: string) => {
    setLoading(true);
    try {
      const data = await attendanceService.getAttendanceBySession(sessionId);
      setAttendance(data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionChange = (value: string) => {
    setSelectedSession(value);
    if (value) loadAttendance(value);
  };

  const handleDownloadReport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!selectedCourse) {
      toast.error('Please select a course');
      return;
    }

    setReportLoading(true);
    try {
      const report = await attendanceService.getAttendanceReportByCourse(selectedCourse);
      const courseData = courses.find(c => c.id === selectedCourse);
      const filename = `attendance-${courseData?.code || 'report'}`;

      if (report.length === 0) {
        toast.error('No attendance data found for this course. Ensure students are enrolled and sessions exist.');
        setReportLoading(false);
        return;
      }

      if (format === 'csv') {
        exportToCSV(report, filename);
      } else if (format === 'excel') {
        exportToExcel(report, filename);
      } else if (format === 'pdf') {
        const columns = ['Full Name', 'Index Number', 'Sessions Attended', 'Total Sessions', 'Attendance Summary'];
        exportToPDF(report, filename, `Attendance Report - ${courseData?.title || filename}`, columns);
      }

      toast.success(`Attendance report exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(`Failed to export report as ${format.toUpperCase()}`);
      console.error(error);
    } finally {
      setReportLoading(false);
    }
  };

  const presentIds = new Set(attendance.map((a) => a.student_id));
  const absentStudents = students.filter((s) => !presentIds.has(s.id));
  const rate = students.length > 0 ? Math.round((attendance.length / students.length) * 100) : 0;

  const selectedSessionData = sessions.find((s) => s.id === selectedSession);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Tracking</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track attendance for your sessions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Download Attendance Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Select Course</label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a course to download report" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCourse && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleDownloadReport('csv')}
                disabled={reportLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadReport('excel')}
                disabled={reportLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadReport('pdf')}
                disabled={reportLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSession && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{attendance.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{absentStudents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Attendance Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary-500">{rate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedSession} onValueChange={handleSessionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a session to view attendance" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title} - {new Date(s.session_date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSession && !loading && (
            <>
              {attendance.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const data = attendance.map((a) => ({
                      'Full Name': a.profiles?.full_name || 'N/A',
                      'Index Number': a.profiles?.index_number || 'N/A',
                    }));
                    exportToCSV(data, `attendance-${selectedSessionData?.attendance_code || 'session'}`);
                    toast.success('Attendance exported to CSV');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              )}

              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Present ({attendance.length})
                  </h3>
                  {attendance.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {attendance.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/10 text-sm text-gray-700 dark:text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          {a.profiles?.full_name || 'Unknown'}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No students present</p>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Absent ({absentStudents.length})
                  </h3>
                  {absentStudents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {absentStudents.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 text-sm text-gray-700 dark:text-gray-300">
                          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          {s.full_name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Everyone is present!</p>
                  )}
                </div>
              </div>
            </>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
