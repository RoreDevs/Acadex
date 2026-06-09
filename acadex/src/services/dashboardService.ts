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
      .select('*', { count: 'exact', head: true });

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
      .select('*', { count: 'exact', head: true });

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
    const { data: programs } = await supabase.from('programs').select('id, name');

    const result = [];
    for (const program of programs || []) {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('program_id', program.id);

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds);

        result.push({
          name: program.name,
          attendance: count || 0,
        });
      }
    }
    return result;
  },
};
