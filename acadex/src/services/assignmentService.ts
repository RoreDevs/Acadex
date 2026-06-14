import { supabase } from '@/lib/supabase';

export const assignmentService = {
  async getAssignmentsByCourse(courseId: string) {
    const { data } = await supabase
      .from('assignments')
      .select('*, profiles(full_name)')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
    return (data || []) as any[];
  },

  async getAssignmentsByProgram(programId: string) {
    const { data } = await supabase
      .from('assignments')
      .select('*, courses(code, title), profiles(full_name)')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    return (data || []) as any[];
  },

  async getAssignmentsForStudent(studentId: string) {
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId);
    
    if (enrollmentError) {
      console.error('Error fetching enrollments:', enrollmentError);
      return [];
    }
    
    if (!enrollments || enrollments.length === 0) {
      console.log('No enrollments found for student:', studentId);
      return [];
    }
    
    const courseIds = enrollments.map((e) => e.course_id);
    const { data, error } = await supabase
      .from('assignments')
      .select('*, courses(code, title), profiles(full_name)')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching assignments:', error);
      return [];
    }
    
    return (data || []) as any[];
  },

  async getAllAssignments() {
    const { data } = await supabase
      .from('assignments')
      .select('*, courses(code, title), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as any[];
  },

  async createAssignment(data: {
    course_id: string;
    title: string;
    description?: string;
    due_date?: string;
    posted_by: string;
    program_id: string;
  }) {
    const { error } = await supabase
      .from('assignments')
      .insert([
        {
          course_id: data.course_id,
          title: data.title,
          description: data.description,
          due_date: data.due_date,
          posted_by: data.posted_by,
          program_id: data.program_id,
        },
      ]);

    return { error };
  },

  async updateAssignment(id: string, data: {
    title?: string;
    description?: string;
    due_date?: string;
  }) {
    const { error } = await supabase
      .from('assignments')
      .update(data)
      .eq('id', id);

    return { error };
  },

  async deleteAssignment(id: string) {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    return { error };
  },

  formatDueDate(date: string | null) {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },
};
