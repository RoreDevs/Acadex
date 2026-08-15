import { supabase } from '@/lib/supabase';

export const slideService = {
  async getSlidesByCourse(courseId: string, programId?: string) {
    let query = supabase
      .from('slides')
      .select('*, profiles(full_name)')
      .eq('course_id', courseId);

    if (programId) {
      query = query.eq('program_id', programId);
    }

    const { data } = await query.order('created_at', { ascending: false });
    return (data || []) as any[];
  },

  async getSlidesByProgram(programId: string) {
    const { data } = await supabase
      .from('slides')
      .select('*, courses(code, title), profiles(full_name)')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    return (data || []) as any[];
  },

  async getSlidesForStudent(studentId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('program')
      .eq('id', studentId)
      .single();

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId);

    const programId = profile?.program;
    if (!programId) return [];

    let query = supabase
      .from('slides')
      .select('*, courses(code, title), profiles(full_name)')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });

    if (enrollments && enrollments.length > 0) {
      const courseIds = enrollments.map((e) => e.course_id);
      query = query.in('course_id', courseIds);
    }

    const { data } = await query;
    return (data || []) as any[];
  },

  async getAllSlides() {
    const { data } = await supabase
      .from('slides')
      .select('*, courses(code, title), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as any[];
  },

  async createSlide(data: {
    course_id: string;
    title: string;
    uploaded_by: string;
    program_id: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    semester_id?: string;
    course_offering_id?: string;
  }) {
    const { error } = await supabase.from('slides').insert([
      {
        course_id: data.course_id,
        title: data.title,
        uploaded_by: data.uploaded_by,
        program_id: data.program_id,
        file_url: data.file_url,
        file_name: data.file_name,
        file_size: data.file_size,
        semester_id: data.semester_id ?? null,
        course_offering_id: data.course_offering_id ?? null,
      },
    ]);
    return { error };
  },

  async deleteSlide(id: string) {
    const { data: slide } = await supabase
      .from('slides')
      .select('file_url')
      .eq('id', id)
      .single();

    if (slide?.file_url) {
      await this.deleteFile(slide.file_url);
    }

    const { error } = await supabase
      .from('slides')
      .delete()
      .eq('id', id);

    return { error };
  },

  async uploadFile(file: File, programId: string, courseId: string) {
    const allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt'];
    const fileExt = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(fileExt)) {
      return { error: { message: 'Unsupported file type.' } as any, url: null };
    }
    if (file.size > 52428800) {
      return { error: { message: 'File exceeds the 50MB limit.' } as any, url: null };
    }
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `slides/${programId}/${courseId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('slides')
      .upload(filePath, file);

    if (uploadError) return { error: uploadError, url: null };

    const { data: urlData } = supabase.storage
      .from('slides')
      .getPublicUrl(filePath);

    return { error: null, url: urlData.publicUrl };
  },

  async deleteFile(fileUrl: string) {
    const path = fileUrl.split('/').slice(-4).join('/');
    await supabase.storage.from('slides').remove([path]);
  },

  formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};
