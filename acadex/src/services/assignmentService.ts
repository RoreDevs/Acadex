import { supabase } from '@/lib/supabase';

export const assignmentService = {
  async getAssignmentsByCourse(courseId: string, programId?: string) {
    let query = supabase
      .from('assignments')
      .select('*, profiles(full_name)')
      .eq('course_id', courseId);
    
    if (programId) {
      query = query.eq('program_id', programId);
    }
    
    const { data } = await query.order('created_at', { ascending: false });
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
    // Get student's profile to get their program
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('program')
      .eq('id', studentId)
      .single();
    
    if (profileError || !profile) {
      console.error('Error fetching student profile:', profileError);
      return [];
    }

    // Get student's enrolled courses
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId);
    
    if (enrollmentError) {
      console.error('Error fetching enrollments:', enrollmentError);
    }

    // Get program ID from program code/name
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('id')
      .eq('code', profile.program)
      .single();
    
    if (programError) {
      console.error('Error fetching program:', programError);
    }

    let query = supabase
      .from('assignments')
      .select('*, courses(code, title), profiles(full_name)')
      .order('created_at', { ascending: false });

    // If student has enrollments, query by course IDs
    if (enrollments && enrollments.length > 0) {
      const courseIds = enrollments.map((e) => e.course_id);
      query = query.in('course_id', courseIds);
    }

    // Also query assignments for their program
    if (programData) {
      if (enrollments && enrollments.length > 0) {
        // Use OR logic by querying program separately and merging
        const { data: programAssignments, error: programAssignmentError } = await supabase
          .from('assignments')
          .select('*, courses(code, title), profiles(full_name)')
          .eq('program_id', programData.id)
          .order('created_at', { ascending: false });

        if (programAssignmentError) {
          console.error('Error fetching program assignments:', programAssignmentError);
        }

        const { data: courseAssignments, error: courseError } = await query;

        if (courseError) {
          console.error('Error fetching course assignments:', courseError);
          return (programAssignments || []) as any[];
        }

        // Merge and deduplicate by ID
        const merged = [...(courseAssignments || []), ...(programAssignments || [])];
        const seen = new Set<string>();
        return merged.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        }) as any[];
      } else {
        // Only query by program if no enrollments
        query = query.eq('program_id', programData.id);
      }
    }

    const { data, error } = await query;
    
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
