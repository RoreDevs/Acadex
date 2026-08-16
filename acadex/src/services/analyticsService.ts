import { supabase } from '@/lib/supabase';
import type {
  AdminOverview,
  CourseAnalytics,
  StudentAnalytics,
  SuperAdminAnalytics,
} from '@/types';

export const analyticsService = {
  async getStudentAnalytics(semesterId?: string, courseId?: string): Promise<StudentAnalytics> {
    const { data, error } = await supabase.rpc('get_student_attendance_analytics', {
      p_semester_id: semesterId || null,
      p_course_id: courseId || null,
    });
    if (error) {
      console.error('[analyticsService] getStudentAnalytics RPC error:', error);
      throw error;
    }
    console.log('[analyticsService] getStudentAnalytics result:', JSON.stringify(data).slice(0, 200));
    return data as StudentAnalytics;
  },

  async getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
    const { data, error } = await supabase.rpc('get_course_attendance_analytics', {
      p_course_id: courseId,
    });
    if (error) throw error;
    return data as CourseAnalytics;
  },

  async getAdminOverview(semesterId?: string, startDate?: string, endDate?: string): Promise<AdminOverview> {
    const { data, error } = await supabase.rpc('get_admin_attendance_overview', {
      p_semester_id: semesterId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });
    if (error) throw error;
    return data as AdminOverview;
  },

  async getSuperAdminAnalytics(semesterId?: string, startDate?: string, endDate?: string): Promise<SuperAdminAnalytics> {
    const { data, error } = await supabase.rpc('get_super_admin_attendance_analytics', {
      p_semester_id: semesterId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });
    if (error) throw error;
    return data as SuperAdminAnalytics;
  },
};
