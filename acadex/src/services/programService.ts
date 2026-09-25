import { supabase } from '@/lib/supabase';
import type { Program } from '@/types';

export const programService = {
  async getPrograms() {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .order('name');
    if (error) console.error('getPrograms error:', error.message);
    return (data || []) as Program[];
  },

  async getProgramById(id: string) {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .single();
    return data as Program | null;
  },

  async createProgram(data: { name: string; code: string }) {
    const { data: program, error } = await supabase
      .from('programs')
      .insert([data])
      .select()
      .single();
    return { data: program as Program | null, error };
  },

  async updateProgram(id: string, updates: Partial<Program>) {
    const { error } = await supabase
      .from('programs')
      .update(updates)
      .eq('id', id);
    return { error };
  },

  async deleteProgram(id: string) {
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', id);
    return { error };
  },

  async searchPrograms(query: string) {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
    return (data || []) as Program[];
  },
};
