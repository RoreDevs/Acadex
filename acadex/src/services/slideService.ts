import { supabase } from '@/lib/supabase';
import type { Slide } from '@/types';

export const slideService = {
  async getSlidesByCourse(courseId: string) {
    const { data } = await supabase
      .from('slides')
      .select('*, profiles(full_name)')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
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
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId);
    if (!enrollments || enrollments.length === 0) return [];
    const courseIds = enrollments.map((e) => e.course_id);
    const { data } = await supabase
      .from('slides')
      .select('*, courses(code, title), profiles(full_name)')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false });
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

  async uploadFile(file: File, programId: string, courseId: string) {
    const fileExt = file.name.split('.').pop();
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

  async createSlideRecord(data: {
    title: string;
    course_id: string;
    program_id: string;
    uploaded_by: string;
    file_url: string;
    file_name: string;
    file_size: number;
  }) {
    const { error } = await supabase.from('slides').insert([
      {
        course_id: data.course_id,
        title: data.title,
        file_url: data.file_url,
        file_name: data.file_name,
        file_size: data.file_size,
        uploaded_by: data.uploaded_by,
        program_id: data.program_id,
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
      const path = slide.file_url.split('/').slice(-4).join('/');
      await supabase.storage.from('slides').remove([path]);
    }

    const { error } = await supabase
      .from('slides')
      .delete()
      .eq('id', id);

    return { error };
  },

  formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};
