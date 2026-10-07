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
      // Admins are created from students of a class cohort and every
      // class-scoped query is filtered by the viewer's own level, so the
      // class admin(s) must move with their students. super_admin excluded.
      .in('role', ['student', 'admin'])
      .eq('program', program)
      .eq('level', currentLevel);

    if (error) return { error };

    // A class admin can end up on a stale level if a promotion ran before
    // admins were included in the update above. Bring any admin of this
    // program whose level is out of sync forward to the class's new level so
    // the cohort ends up consistent (admins already at the new level are
    // left untouched).
    const { error: adminError } = await supabase
      .from('profiles')
      .update({ level: newLevel })
      .eq('role', 'admin')
      .eq('program', program)
      .neq('level', newLevel);

    return { error: adminError };
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
};
