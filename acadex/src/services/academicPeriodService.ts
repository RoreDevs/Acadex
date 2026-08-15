import { supabase } from '@/lib/supabase';
import type { AcademicYear, CourseOffering, CurrentAcademicPeriod, Semester } from '@/types';

export interface YearInput {
  name: string;
  start_date: string;
  end_date: string;
}

export interface SemesterInput {
  academic_year_id: string;
  name: string;
  semester_number: number;
  start_date: string;
  end_date: string;
}

export const academicPeriodService = {
  async getCurrentPeriod(): Promise<CurrentAcademicPeriod> {
    const { data, error } = await supabase.rpc('get_current_academic_period');
    if (!error && data) {
      return data as CurrentAcademicPeriod;
    }

    const { data: semester } = await supabase
      .from('semesters')
      .select('*, academic_years(*)')
      .eq('is_current', true)
      .maybeSingle();

    if (semester) {
      return { year: (semester.academic_years as AcademicYear | undefined) ?? null, semester: semester as Semester };
    }

    const { data: year } = await supabase
      .from('academic_years')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();

    return { year: (year as AcademicYear | undefined) ?? null, semester: null };
  },

  async getYears(): Promise<AcademicYear[]> {
    const { data } = await supabase
      .from('academic_years')
      .select('*, semesters(*)')
      .order('start_date', { ascending: false });
    return (data || []) as AcademicYear[];
  },

  async getYearById(id: string): Promise<AcademicYear | null> {
    const { data } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return (data as AcademicYear | undefined) ?? null;
  },

  async createYear(input: YearInput) {
    const { data, error } = await supabase
      .from('academic_years')
      .insert([input])
      .select()
      .single();
    return { data: (data as AcademicYear | undefined) ?? null, error };
  },

  async updateYear(id: string, updates: Partial<YearInput>) {
    const { error } = await supabase
      .from('academic_years')
      .update(updates)
      .eq('id', id);
    return { error };
  },

  async archiveYear(id: string) {
    const { error } = await supabase
      .from('academic_years')
      .update({ is_archived: true })
      .eq('id', id);
    return { error };
  },

  async setCurrentYear(id: string) {
    const { error } = await supabase.rpc('set_current_academic_year', { p_year_id: id });
    return { error };
  },

  async getSemesters(yearId: string): Promise<Semester[]> {
    const { data } = await supabase
      .from('semesters')
      .select('*, academic_years(name)')
      .eq('academic_year_id', yearId)
      .order('semester_number');
    return (data || []) as Semester[];
  },

  async createSemester(input: SemesterInput) {
    const { data, error } = await supabase
      .from('semesters')
      .insert([input])
      .select()
      .single();
    return { data: (data as Semester | undefined) ?? null, error };
  },

  async updateSemester(id: string, updates: Partial<SemesterInput>) {
    const { error } = await supabase
      .from('semesters')
      .update(updates)
      .eq('id', id);
    return { error };
  },

  async archiveSemester(id: string) {
    const { error } = await supabase
      .from('semesters')
      .update({ is_archived: true })
      .eq('id', id);
    return { error };
  },

  async setCurrentSemester(id: string) {
    const { error } = await supabase.rpc('set_current_semester', { p_semester_id: id });
    return { error };
  },

  async deleteSemester(id: string) {
    const { error } = await supabase
      .from('semesters')
      .delete()
      .eq('id', id);
    return { error };
  },

  async deleteYear(id: string) {
    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', id);
    return { error };
  },

  async getOfferingsBySemester(semesterId: string) {
    const { data } = await supabase
      .from('course_offerings')
      .select('*, courses(code, title), programs(name)')
      .eq('semester_id', semesterId)
      .order('level');
    return (data || []) as any[];
  },

  async getOfferingsByCourseAndProgram(courseId: string, programId: string, level?: string) {
    let query = supabase
      .from('course_offerings')
      .select('*, semesters(id, name, semester_number)')
      .eq('course_id', courseId)
      .eq('program_id', programId);
    if (level) query = query.eq('level', level);
    const { data } = await query.order('created_at', { ascending: false });
    return (data || []) as CourseOffering[];
  },

  async getOfferingCounts(): Promise<Record<string, number>> {
    const { data } = await supabase.from('course_offerings').select('semester_id');
    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      map[row.semester_id] = (map[row.semester_id] || 0) + 1;
    }
    return map;
  },

  async getCurrentOffering(courseId: string, programId: string, level: string, semesterId?: string): Promise<CourseOffering | null> {
    let semester = semesterId;
    if (!semester) {
      const period = await this.getCurrentPeriod();
      semester = period.semester?.id;
    }
    if (!semester) return null;

    const { data } = await supabase
      .from('course_offerings')
      .select('*')
      .eq('course_id', courseId)
      .eq('program_id', programId)
      .eq('level', level)
      .eq('semester_id', semester)
      .maybeSingle();

    if (data) return data as CourseOffering;

    const { data: created } = await supabase
      .from('course_offerings')
      .insert([{ course_id: courseId, program_id: programId, level, semester_id: semester, is_active: true }])
      .select()
      .maybeSingle();

    return (created as CourseOffering | undefined) ?? null;
  },
};
