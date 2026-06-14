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
    try {
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

      // Get program ID from program code
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id')
        .eq('code', profile.program)
        .single();
      
      if (programError) {
        console.error('Error fetching program:', programError);
      }

      // Get student's enrolled courses
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentId);
      
      if (enrollmentError) {
        console.error('Error fetching enrollments:', enrollmentError);
      }

      // Fetch assignments from both sources
      let allAssignments: any[] = [];

      // Query 1: Get assignments by enrolled courses
      if (enrollments && enrollments.length > 0) {
        const courseIds = enrollments.map((e) => e.course_id);
        const { data: courseAssignments, error: courseError } = await supabase
          .from('assignments')
          .select('*, courses(code, title), profiles(full_name)')
          .in('course_id', courseIds)
          .order('created_at', { ascending: false });

        if (courseError) {
          console.error('Error fetching course assignments:', courseError);
        } else if (courseAssignments) {
          allAssignments = courseAssignments;
        }
      }

      // Query 2: Get assignments for their program
      if (programData) {
        const { data: programAssignments, error: programError } = await supabase
          .from('assignments')
          .select('*, courses(code, title), profiles(full_name)')
          .eq('program_id', programData.id)
          .order('created_at', { ascending: false });

        if (programError) {
          console.error('Error fetching program assignments:', programError);
        } else if (programAssignments) {
          // Merge and deduplicate by ID
          const seenIds = new Set(allAssignments.map((a) => a.id));
          const newAssignments = programAssignments.filter(
            (a) => !seenIds.has(a.id)
          );
          allAssignments = [...allAssignments, ...newAssignments];
        }
      }

      // Sort by created_at descending
      return allAssignments.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) as any[];
    } catch (error) {
      console.error('Unexpected error in getAssignmentsForStudent:', error);
      return [];
    }
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
