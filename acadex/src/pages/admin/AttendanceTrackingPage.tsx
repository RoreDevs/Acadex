import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Users, FileText, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { attendanceService } from '@/services/attendanceService';
import { sessionService } from '@/services/sessionService';
import { profileService } from '@/services/profileService';
import { courseService } from '@/services/courseService';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/export';
import { useAuth } from '@/contexts/AuthContext';
import type { AttendanceStatus } from '@/types';
import toast from 'react-hot-toast';

const statusMeta: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' | 'outline' }> = {
  present: { label: 'Present', variant: 'success' },
  late: { label: 'Late', variant: 'warning' },
  absent: { label: 'Absent', variant: 'danger' },
  excused: { label: 'Excused', variant: 'default' },
  not_marked: { label: 'Not Marked', variant: 'outline' },
};

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
];

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

  const [editStudent, setEditStudent] = useState<any>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editReason, setEditReason] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  const recordByStudent = useMemo(() => {
    const map: Record<string, any> = {};
    for (const a of attendance) map[a.student_id] = a;
    return map;
  }, [attendance]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { present: 0, late: 0, absent: 0, excused: 0, not_marked: 0 };
    for (const s of students) {
      const rec = recordByStudent[s.id];
      const key = rec ? (statusMeta[rec.status] ? rec.status : 'not_marked') : 'not_marked';
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, [students, recordByStudent]);

  const rate = students.length > 0
    ? Math.round(((counts.present + counts.late) / students.length) * 100)
    : 0;

  const openEdit = (student: any) => {
    const rec = recordByStudent[student.id];
    setEditStudent(student);
    setEditStatus(rec?.status && statusOptions.some((o) => o.value === rec.status) ? rec.status : 'present');
    setEditReason(rec?.modified_reason || '');
  };

  const saveEdit = async () => {
    if (!editStudent || !selectedSession) return;
    if (!editReason.trim()) {
      toast.error('A reason is required for manual attendance changes.');
      return;
    }
    setEditSaving(true);
    const { result, error } = await attendanceService.adminSetAttendanceStatus(
      selectedSession,
      editStudent.id,
      editStatus,
      editReason.trim()
    );
    setEditSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!result?.success) {
      toast.error(result?.message || 'Failed to update attendance.');
      return;
    }
    toast.success(`Attendance updated to ${statusMeta[editStatus].label}`);
    setEditStudent(null);
    loadAttendance(selectedSession);
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
        const courseDetail = courseData ? `${courseData.code} - ${courseData.title}` : selectedCourse;
        const sessionsForCourse = sessions.filter(s => s.course_id === selectedCourse);
        toast.error(`No attendance records found for "${courseDetail}". This course has ${sessionsForCourse.length} session(s). Students may not have marked attendance yet.`);
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

      toast.success(`Attendance report exported as ${format.toUpperCase()} (${report.length} students)`);
    } catch (error) {
      toast.error(`Failed to export report as ${format.toUpperCase()}`);
      console.error(error);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Tracking</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track attendance and make manual corrections</p>
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
              <Button variant="outline" onClick={() => handleDownloadReport('csv')} disabled={reportLoading}>
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button variant="outline" onClick={() => handleDownloadReport('excel')} disabled={reportLoading}>
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
              <Button variant="outline" onClick={() => handleDownloadReport('pdf')} disabled={reportLoading}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Session
          </CardTitle>
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
        </CardContent>
      </Card>

      {selectedSession && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.present}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Late</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.late}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.absent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Excused</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{counts.excused}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Not Marked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-500">{counts.not_marked}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Attendance Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary-500">{rate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedSession && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Roster ({students.length} students)
              </CardTitle>
              {attendance.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const data = students.map((s) => {
                      const rec = recordByStudent[s.id];
                      return {
                        'Full Name': s.full_name || 'N/A',
                        'Index Number': s.index_number || 'N/A',
                        Status: rec ? statusMeta[rec.status]?.label || rec.status : 'Not Marked',
                        Time: rec ? new Date(rec.timestamp).toLocaleTimeString() : '-',
                      };
                    });
                    exportToCSV(data, `attendance-roster-${selectedSession.slice(0, 8)}`);
                    toast.success('Roster exported to CSV');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Index Number</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                          No students found for your program and level.
                        </td>
                      </tr>
                    ) : (
                      students.map((s) => {
                        const rec = recordByStudent[s.id];
                        const meta = statusMeta[rec ? (statusMeta[rec.status] ? rec.status : 'not_marked') : 'not_marked'];
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.full_name}</td>
                            <td className="px-4 py-3 text-gray-500">{s.index_number}</td>
                            <td className="px-4 py-3">
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {rec ? new Date(rec.timestamp).toLocaleTimeString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-400 max-w-[180px] truncate">
                              {rec?.modified_reason || '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                Update
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editStudent} onOpenChange={(open) => { if (!open) setEditStudent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Attendance</DialogTitle>
            <DialogDescription>
              {editStudent?.full_name} · {editStudent?.index_number}. Manual changes require a reason and are recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AttendanceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason (required)</Label>
              <Textarea
                id="edit-reason"
                placeholder="e.g., Student arrived 10 minutes after close, medically excused, etc."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStudent(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving || !editReason.trim()}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
