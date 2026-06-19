import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data as UserProfile | null;
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    return { error };
  },

  async getAllStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name');
    return (data || []) as UserProfile[];
  },

  async getAllAdmins() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'super_admin'])
      .order('full_name');
    return (data || []) as UserProfile[];
  },

  async getStudentsByProgram(program: string, level: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('program', program)
      .eq('level', level)
      .order('full_name');
    return (data || []) as UserProfile[];
  },

  async updateRole(userId: string, role: 'student' | 'admin' | 'super_admin') {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    return { error };
  },

  async deleteProfile(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    return { error };
  },

  async promoteLevel(program: string, currentLevel: string, newLevel: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ level: newLevel })
      .eq('role', 'student')
      .eq('program', program)
      .eq('level', currentLevel);
    return { error };
  },

  async superAdminExists(): Promise<boolean> {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin');
    return (count ?? 0) > 0;
  },

  async searchProfiles(query: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${query}%,index_number.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20);
    return (data || []) as UserProfile[];
  },

  async getStudentClasses(programId: string) {
    const { data } = await supabase
      .from('student_classes')
      .select('*')
      .eq('program_id', programId);
    return (data || []) as { student_id: string; class: 'A' | 'B' }[];
  },

  async setStudentClass(studentId: string, programId: string, studentClass: 'A' | 'B') {
    const { error } = await supabase
      .from('student_classes')
      .upsert(
        { student_id: studentId, program_id: programId, class: studentClass, updated_at: new Date().toISOString() },
        { onConflict: 'student_id, program_id' }
      );
    return { error };
  },
};
