import { supabase } from '@/lib/supabase';
import type { Slide } from '@/types';

const STORAGE_BUCKET = 'slides';

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

  async ensureBucket() {
    const { error: getError } = await supabase.storage.getBucket(STORAGE_BUCKET);
    if (!getError) return;

    const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 52428800,
    });
    if (!createError) return;

    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: `INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types) VALUES ('${STORAGE_BUCKET}', '${STORAGE_BUCKET}', TRUE, FALSE, 52428800, NULL) ON CONFLICT (id) DO NOTHING;`,
    });
    if (rpcError) {
      console.error('Failed to ensure storage bucket:', rpcError.message);
    }
  },

  async uploadSlide(file: File, data: {
    title: string;
    course_id: string;
    program_id: string;
    uploaded_by: string;
  }) {
    await this.ensureBucket();
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${data.program_id}/${data.course_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file);

    if (uploadError) return { error: uploadError };

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from('slides').insert([
      {
        course_id: data.course_id,
        title: data.title,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: data.uploaded_by,
        program_id: data.program_id,
      },
    ]);

    return { error: insertError };
  },

  async deleteSlide(id: string) {
    const { data: slide } = await supabase
      .from('slides')
      .select('file_url')
      .eq('id', id)
      .single();

    if (slide?.file_url) {
      const path = slide.file_url.split('/').slice(-3).join('/');
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
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
