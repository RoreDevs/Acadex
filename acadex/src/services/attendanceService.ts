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
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id', { count: 'exact' });

    const { data: attended } = await supabase
      .from('attendance')
      .select('id', { count: 'exact' })
      .eq('student_id', studentId);

    const { data: courses } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact' })
      .eq('student_id', studentId);

    const totalSessions = sessions?.length || 0;
    const totalAttended = attended?.length || 0;
    const totalCourses = courses?.length || 0;
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
};
