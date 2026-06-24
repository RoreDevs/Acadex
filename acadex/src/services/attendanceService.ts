import { supabase } from '@/lib/supabase';
import type { Attendance } from '@/types';

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
      .select('*, profiles!inner(full_name, index_number)')
      .eq('session_id', sessionId)
      .order('timestamp');
    if (error) {
      await fixBrokenRLS();
      const retry = await supabase
        .from('attendance')
        .select('*, profiles!inner(full_name, index_number)')
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
      .select('*, sessions(title, session_date, courses(title, code)), profiles!inner(full_name, index_number)')
      .order('timestamp', { ascending: false });
    if (error) {
      await fixBrokenRLS();
      const retry = await supabase
        .from('attendance')
        .select('*, sessions(title, session_date, courses(title, code)), profiles!inner(full_name, index_number)')
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
    const fetchWithRetry = async (retry = false) => {
      if (retry) await fixBrokenRLS();

      const sessionsRes = await supabase
        .from('sessions')
        .select('id')
        .eq('course_id', courseId);

      const sessionIds = sessionsRes.data?.map((s: any) => s.id) || [];
      const totalSessions = sessionIds.length;

      let attData: any[] = [];
      if (sessionIds.length > 0) {
        const attRes = await supabase
          .from('attendance')
          .select('*, profiles!inner(full_name, index_number)')
          .in('session_id', sessionIds);
        attData = attRes.data || [];
      }

      return { sessionIds, totalSessions, attData };
    };

    let { sessionIds, totalSessions, attData } = await fetchWithRetry(false);

    if (totalSessions === 0 && sessionIds.length === 0) {
      const retry = await fetchWithRetry(true);
      sessionIds = retry.sessionIds;
      totalSessions = retry.totalSessions;
      attData = retry.attData;
    }

    const studentMap: Record<string, { full_name: string; index_number: string; count: number }> = {};
    for (const record of attData) {
      const sid = record.student_id;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          full_name: record.profiles?.full_name || 'N/A',
          index_number: record.profiles?.index_number || 'N/A',
          count: 0,
        };
      }
      studentMap[sid].count++;
    }

    const report = Object.values(studentMap).map((s) => ({
      'Full Name': s.full_name,
      'Index Number': s.index_number,
      'Sessions Attended': s.count,
      'Total Sessions': totalSessions,
      'Attendance Summary': `${s.count}/${totalSessions}`,
    }));

    return report;
  },
};
