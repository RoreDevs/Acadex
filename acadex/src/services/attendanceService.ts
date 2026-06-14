import { supabase } from '@/lib/supabase';
import type { Attendance } from '@/types';

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
    const { data } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, start_time, end_time, courses(title, code))')
      .eq('student_id', studentId)
      .order('timestamp', { ascending: false });
    return (data || []) as any[];
  },

  async getAttendanceBySession(sessionId: string) {
    const { data } = await supabase
      .from('attendance')
      .select('*, profiles(full_name, index_number)')
      .eq('session_id', sessionId)
      .order('timestamp');
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

  async getStudentStats(studentId: string) {
    const { data: enrolledCourses } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId);

    const courseIds = enrolledCourses?.map(e => e.course_id) || [];

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id', { count: 'exact' })
      .in('course_id', courseIds.length > 0 ? courseIds : ['none']);

    const { data: attended } = await supabase
      .from('attendance')
      .select('id', { count: 'exact' })
      .eq('student_id', studentId);

    const totalSessions = sessions?.length || 0;
    const totalAttended = attended?.length || 0;
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
    const { data } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
      .order('timestamp', { ascending: false });
    return (data || []) as any[];
  },

  async getAttendanceByDateRange(startDate: string, endDate: string) {
    const { data } = await supabase
      .from('attendance')
      .select('*, sessions(title, session_date, courses(title, code)), profiles(full_name, index_number)')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false });
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
