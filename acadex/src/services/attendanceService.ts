import { supabase } from '@/lib/supabase';
import type { AttendanceStatus } from '@/types';

export const attendanceService = {
  async getSessionForMarking(code: string) {
    const { data, error } = await supabase.rpc('get_session_for_marking', {
      p_attendance_code: code.toUpperCase(),
    });
    if (error) return { result: null, error };
    return { result: data as any, error: null };
  },

  async markAttendanceByCode(code: string, coords: { latitude: number; longitude: number }) {
    const { data, error } = await supabase.rpc('mark_attendance', {
      p_attendance_code: code.toUpperCase(),
      p_student_lat: coords.latitude,
      p_student_lng: coords.longitude,
    });
    if (error) return { result: null, error };
    return { result: data as any, error: null };
  },

  async adminSetAttendanceStatus(
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    reason: string
  ) {
    const { data, error } = await supabase.rpc('admin_set_attendance_status', {
      p_session_id: sessionId,
      p_student_id: studentId,
      p_status: status,
      p_reason: reason,
    });
    if (error) return { result: null, error };
    return { result: data as any, error: null };
  },

  async getAttendanceByStudent(studentId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, start_time, end_time, courses(title, code))')
      .eq('student_id', studentId)
      .order('timestamp', { ascending: false });
    if (error) console.error('getAttendanceByStudent error:', error.message);
    return (data || []) as any[];
  },

  async getAttendanceBySession(sessionId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, profiles!inner(full_name, index_number)')
      .eq('session_id', sessionId)
      .order('timestamp');
    if (error) console.error('getAttendanceBySession error:', error.message);
    return (data || []) as any[];
  },

  async checkAttendance(sessionId: string, studentId: string) {
    const { data } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle();
    return !!data;
  },

  async verifyAndMarkAttendance(studentId: string, sessionId: string, coords: { latitude: number; longitude: number }) {
    const { data, error } = await supabase.rpc('verify_attendance_location', {
      p_student_id: studentId,
      p_session_id: sessionId,
      p_student_lat: coords.latitude,
      p_student_lng: coords.longitude,
    });
    if (error) return { result: null, error };
    return { result: data as any, error: null };
  },

  async getStudentStats(studentId: string) {
    const [enrolledCourses, attended] = await Promise.all([
      supabase.from('enrollments').select('course_id').eq('student_id', studentId),
      supabase.from('attendance').select('id', { count: 'exact' })
        .eq('student_id', studentId)
        .in('status', ['present', 'late']),
    ]);

    const courseIds = enrolledCourses.data?.map((e: any) => e.course_id) || [];

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id', { count: 'exact' })
      .in('course_id', courseIds.length > 0 ? courseIds : ['none']);

    const totalSessions = sessions?.length || 0;
    const totalAttended = attended.data?.length || 0;
    const totalCourses = courseIds.length;
    const rate = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

    return {
      attendance_rate: rate,
      classes_attended: totalAttended,
      total_courses: totalCourses,
      total_sessions: totalSessions,
    };
  },

  async getAllAttendanceRecords() {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, courses(title, code)), profiles!inner(full_name, index_number)')
      .order('timestamp', { ascending: false });
    if (error) console.error('getAllAttendanceRecords error:', error.message);
    return (data || []) as any[];
  },

  async getAttendanceByDateRange(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false });
    if (error) console.error('getAttendanceByDateRange error:', error.message);
    return (data || []) as any[];
  },

  async getMonthlyAttendance(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    return attendanceService.getAttendanceByDateRange(startDate, endDate);
  },

  async getAttendanceReportByCourse(courseId: string) {
    const sessionsRes = await supabase.from('sessions').select('id').eq('course_id', courseId);
    const sessionIds = sessionsRes.data?.map((s: any) => s.id) || [];

    let attRecords: any[] = [];
    if (sessionIds.length > 0) {
      const attRes = await supabase.from('attendance').select('student_id').in('session_id', sessionIds);
      attRecords = attRes.data || [];
    }

    const totalSessions = sessionIds.length;
    const studentIds = [...new Set(attRecords.map((r: any) => r.student_id))];

    let profilesData: any[] = [];
    if (studentIds.length > 0) {
      const profRes = await supabase
        .from('profiles')
        .select('id, full_name, index_number')
        .in('id', studentIds);
      profilesData = profRes.data || [];
    }

    const profileMap: Record<string, any> = {};
    for (const p of profilesData) profileMap[p.id] = p;

    const attendanceCount: Record<string, number> = {};
    for (const rec of attRecords) {
      attendanceCount[rec.student_id] = (attendanceCount[rec.student_id] || 0) + 1;
    }

    const report = studentIds.map((sid) => ({
      'Full Name': profileMap[sid]?.full_name || 'N/A',
      'Index Number': profileMap[sid]?.index_number || 'N/A',
      'Sessions Attended': attendanceCount[sid] || 0,
      'Total Sessions': totalSessions,
      'Attendance Summary': `${attendanceCount[sid] || 0}/${totalSessions}`,
    }));

    if (report.length === 0) {
      report.push({
        'Full Name': 'No students have marked attendance yet',
        'Index Number': '-',
        'Sessions Attended': 0,
        'Total Sessions': totalSessions,
        'Attendance Summary': `0/${totalSessions}`,
      });
    }

    return report;
  },
};
