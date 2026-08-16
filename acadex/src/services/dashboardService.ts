import { supabase } from '@/lib/supabase';
import type { DashboardStats } from '@/types';

export const dashboardService = {
  async getSuperAdminStats(): Promise<DashboardStats> {
    const { count: total_students } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    const { count: total_admins } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'super_admin']);

    const { count: total_sessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });

    const { count: active_sessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: total_courses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    const { count: total_programs } = await supabase
      .from('programs')
      .select('*', { count: 'exact', head: true });

    const { count: total_attendance } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .in('status', ['present', 'late']);

    return {
      total_students: total_students || 0,
      total_admins: total_admins || 0,
      total_sessions: total_sessions || 0,
      active_sessions: active_sessions || 0,
      total_courses: total_courses || 0,
      total_programs: total_programs || 0,
      attendance_rate: total_sessions && total_sessions > 0
        ? Math.round(((total_attendance || 0) / (total_sessions * (total_students || 1))) * 100)
        : 0,
      total_attendance: total_attendance || 0,
    };
  },

  async getAdminStats(programId: string, level: string): Promise<DashboardStats> {
    const { count: total_students } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('program', programId)
      .eq('level', level);

    const { data: programSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('program_id', programId)
      .eq('level', level);

    const sessionIds = (programSessions || []).map((s: any) => s.id);

    const { count: total_sessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId)
      .eq('level', level);

    const { count: active_sessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('program_id', programId)
      .eq('level', level);

    const { count: total_courses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId)
      .eq('level', level);

    const { count: total_attendance } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .in('status', ['present', 'late'])
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['none']);

    return {
      total_students: total_students || 0,
      total_admins: 0,
      total_sessions: total_sessions || 0,
      active_sessions: active_sessions || 0,
      total_courses: total_courses || 0,
      total_programs: 0,
      attendance_rate: total_sessions && total_sessions > 0
        ? Math.round(((total_attendance || 0) / (total_sessions * (total_students || 1))) * 100)
        : 0,
      total_attendance: total_attendance || 0,
    };
  },

  async getAttendanceTrends(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('attendance')
      .select('timestamp')
      .in('status', ['present', 'late'])
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp');

    const trends: { [key: string]: number } = {};
    (data || []).forEach((record) => {
      const date = record.timestamp.split('T')[0];
      trends[date] = (trends[date] || 0) + 1;
    });

    return Object.entries(trends).map(([date, count]) => ({ date, count }));
  },

  async getProgramAttendanceComparison() {
    // Two queries instead of N+1: fetch sessions (with program) once, then attendance once.
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, program_id, programs(name)');

    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length === 0) return [];

    const { data: attendance } = await supabase
      .from('attendance')
      .select('session_id')
      .in('status', ['present', 'late'])
      .in('session_id', sessionIds);

    const programNameById: Record<string, string> = {};
    const countByProgram: Record<string, number> = {};
    for (const s of sessions || []) {
      const pid = s.program_id as string;
      programNameById[pid] = (s.programs as any)?.name || pid;
      if (countByProgram[pid] === undefined) countByProgram[pid] = 0;
    }
    for (const a of attendance || []) {
      const pid = (sessions || []).find((s: any) => s.id === a.session_id)?.program_id as string;
      if (pid) countByProgram[pid] = (countByProgram[pid] || 0) + 1;
    }

    return Object.entries(countByProgram).map(([pid, attendanceCount]) => ({
      name: programNameById[pid] || pid,
      attendance: attendanceCount,
    }));
  },
};
