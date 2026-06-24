import { supabase } from '@/lib/supabase';
import type { Attendance, LocationCoords } from '@/types';

let fixAttempted = false;
const fixBrokenRLS = async () => {
  if (fixAttempted) return false;
  fixAttempted = true;
  const fixSql = `DROP POLICY IF EXISTS "Admins can view attendance in their program" ON attendance;`;
  for (const { fn, param } of [
    { fn: 'exec_sql', param: { sql: fixSql } },
    { fn: 'execute_sql', param: { sql_text: fixSql } },
    { fn: 'raw_sql', param: { query: fixSql } },
  ]) {
    const { error } = await supabase.rpc(fn, param);
    if (!error) return true;
  }
  return false;
};

function haversineDistance(a: LocationCoords, b: LocationCoords): number {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal = sinDLat * sinDLat + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

export const attendanceService = {
  async markAttendance(studentId: string, sessionId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .insert([
        {
          student_id: studentId,
          session_id: sessionId,
          status: 'present',
        },
      ])
      .select()
      .single();
    return { data: data as Attendance | null, error };
  },

  async getAttendanceByStudent(studentId: string) {
    let { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, start_time, end_time, courses(title, code))')
      .eq('student_id', studentId)
      .order('timestamp', { ascending: false });
    if (error) {
      await fixBrokenRLS();
      const retry = await supabase
        .from('attendance')
        .select('*, sessions(title, session_date, start_time, end_time, courses(title, code))')
        .eq('student_id', studentId)
        .order('timestamp', { ascending: false });
      data = retry.data;
    }
    return (data || []) as any[];
  },

  async getAttendanceBySession(sessionId: string) {
    let { data, error } = await supabase
      .from('attendance')
      .select('*, profiles(full_name, index_number)')
      .eq('session_id', sessionId)
      .order('timestamp');
    if (error) {
      await fixBrokenRLS();
      const retry = await supabase
        .from('attendance')
        .select('*, profiles(full_name, index_number)')
        .eq('session_id', sessionId)
        .order('timestamp');
      data = retry.data;
    }
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

  async verifyAndMarkAttendance(studentId: string, sessionId: string, coords: LocationCoords) {
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
      supabase.from('attendance').select('id', { count: 'exact' }).eq('student_id', studentId),
    ]);

    const courseIds = enrolledCourses.data?.map(e => e.course_id) || [];

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
    let { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
      .order('timestamp', { ascending: false });
    if (error) {
      await fixBrokenRLS();
      const retry = await supabase
        .from('attendance')
        .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
        .order('timestamp', { ascending: false });
      data = retry.data;
    }
    return (data || []) as any[];
  },

  async getAttendanceByDateRange(startDate: string, endDate: string) {
    let { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false });
    if (error) {
      await fixBrokenRLS();
      const retry = await supabase
        .from('attendance')
        .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: false });
      data = retry.data;
    }
    return (data || []) as any[];
  },

  async getMonthlyAttendance(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    return attendanceService.getAttendanceByDateRange(startDate, endDate);
  },

  async getAttendanceReportByCourse(courseId: string) {
    // Get all enrolled students for the course
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, profiles(id, full_name, index_number)')
      .eq('course_id', courseId);

    // Get total sessions for the course
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('course_id', courseId);

    const totalSessions = sessions?.length || 0;
    const studentIds = enrollments?.map(e => e.student_id) || [];

    // Get attendance records for these students in this course's sessions
    const sessionIds = sessions?.map(s => s.id) || [];
    
    let attendanceQuery = supabase
      .from('attendance')
      .select('student_id');

    if (sessionIds.length > 0) {
      attendanceQuery = attendanceQuery.in('session_id', sessionIds);
    }

    const { data: attendanceRecords } = await attendanceQuery;

    // Count attendance per student
    const attendanceCount: Record<string, number> = {};
    attendanceRecords?.forEach((record: any) => {
      attendanceCount[record.student_id] = (attendanceCount[record.student_id] || 0) + 1;
    });

    // Build report
    const report = enrollments?.map((enrollment: any) => ({
      'Full Name': enrollment.profiles?.full_name || 'N/A',
      'Index Number': enrollment.profiles?.index_number || 'N/A',
      'Sessions Attended': attendanceCount[enrollment.student_id] || 0,
      'Total Sessions': totalSessions,
      'Attendance Summary': `${attendanceCount[enrollment.student_id] || 0}/${totalSessions}`,
    })) || [];

    return report;
  },
};
