import { supabase } from '@/lib/supabase';
import type { Course, CurriculumCourse } from '@/types';

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

  // Reusable curriculum: courses configured for a program + level +
  // semester number, shared across academic years (migration 019).
  async getCurriculum(programId: string, level: string, semesterNumber: number) {
    const { data } = await supabase
      .from('curriculum_courses')
      .select('*, courses(*)')
      .eq('program_id', programId)
      .eq('level', level)
      .eq('semester_number', semesterNumber)
      .order('created_at');
    return (data || []) as CurriculumCourse[];
  },

  // Courses a student cohort actually takes: curriculum resolved for
  // their program + level + current semester number.
  async getCurriculumCourses(programId: string, level: string, semesterNumber: number) {
    const rows = await this.getCurriculum(programId, level, semesterNumber);
    return rows
      .map((r) => r.courses)
      .filter(Boolean) as Course[];
  },

  async addCourseToCurriculum(data: {
    program_id: string;
    level: string;
    semester_number: number;
    course_id: string;
  }) {
    const { error } = await supabase
      .from('curriculum_courses')
      .insert([data]);
    return { error };
  },

  async removeCourseFromCurriculum(id: string) {
    const { error } = await supabase
      .from('curriculum_courses')
      .delete()
      .eq('id', id);
    return { error };
  },

  // Academic years whose semesters run offerings of this curriculum.
  async getCurriculumUsage(programId: string, level: string, semesterNumber: number) {
    const rows = await this.getCurriculum(programId, level, semesterNumber);
    const courseIds = rows.map((r) => r.course_id);
    if (courseIds.length === 0) return [] as string[];
    const { data } = await supabase
      .from('course_offerings')
      .select('semester_id, semesters!inner(semester_number, academic_years!inner(name))')
      .eq('program_id', programId)
      .eq('level', level)
      .in('course_id', courseIds);
    const names = new Set<string>();
    for (const o of data || []) {
      const sem = (o as any).semesters;
      if (sem?.semester_number === semesterNumber && sem?.academic_years?.name) {
        names.add(`${sem.academic_years.name} · Semester ${sem.semester_number}`);
      }
    }
    return [...names].sort();
  },
};
