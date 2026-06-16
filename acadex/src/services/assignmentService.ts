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

    const programId = profile.program;
    if (!programId) return [];

    let query = supabase
      .from('assignments')
      .select('*, courses(code, title), profiles(full_name)')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });

    if (enrollments && enrollments.length > 0) {
      const courseIds = enrollments.map((e) => e.course_id);
      query = query.in('course_id', courseIds);
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
    file_url?: string;
    file_name?: string;
    file_size?: number;
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
          file_url: data.file_url,
          file_name: data.file_name,
          file_size: data.file_size,
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
    const { data: assignment } = await supabase
      .from('assignments')
      .select('file_url')
      .eq('id', id)
      .single();

    if (assignment?.file_url) {
      await this.deleteFile(assignment.file_url);
    }

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    return { error };
  },

  async uploadFile(file: File, programId: string, courseId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `assignments/${programId}/${courseId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('assignments')
      .upload(filePath, file);

    if (uploadError) return { error: uploadError, url: null };

    const { data: urlData } = supabase.storage
      .from('assignments')
      .getPublicUrl(filePath);

    return { error: null, url: urlData.publicUrl };
  },

  async deleteFile(fileUrl: string) {
    const path = fileUrl.split('/').slice(-4).join('/');
    await supabase.storage.from('assignments').remove([path]);
  },

  formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
