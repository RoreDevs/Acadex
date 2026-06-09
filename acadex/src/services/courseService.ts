import { supabase } from '@/lib/supabase';
import type { Course } from '@/types';

export const courseService = {
  async getCourses() {
    const { data } = await supabase
      .from('courses')
      .select('*, programs(name)')
      .order('title');
    return (data || []) as any[];
  },

  async getCoursesByProgram(programId: string, level: string) {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('program_id', programId)
      .eq('level', level)
      .order('title');
    return (data || []) as Course[];
  },

  async createCourse(data: {
    code: string;
    title: string;
    program_id: string;
    level: string;
    credits?: number;
  }) {
    const { data: course, error } = await supabase
      .from('courses')
      .insert([data])
      .select()
      .single();
    return { data: course as Course | null, error };
  },

  async updateCourse(id: string, updates: Partial<Course>) {
    const { error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id);
    return { error };
  },

  async deleteCourse(id: string) {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);
    return { error };
  },

  async searchCourses(query: string) {
    const { data } = await supabase
      .from('courses')
      .select('*, programs(name)')
      .or(`title.ilike.%${query}%,code.ilike.%${query}%`)
      .limit(20);
    return (data || []) as any[];
  },

  async getEnrollments(studentId: string) {
    const { data } = await supabase
      .from('enrollments')
      .select('*, courses(*)')
      .eq('student_id', studentId);
    return (data || []) as any[];
  },
};
