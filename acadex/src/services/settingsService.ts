import { supabase } from '@/lib/supabase';
import type { Setting } from '@/types';

export const settingsService = {
  async getSetting(key: string) {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return data?.value || null;
  },

  async getAllSettings() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .order('key');
    return (data || []) as Setting[];
  },

  async updateSetting(key: string, value: string) {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select()
      .single();
    return { data: data as Setting | null, error };
  },
};
