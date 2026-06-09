import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types';

export const auditService = {
  async logAction(userId: string, userName: string, action: string, details?: string) {
    const { error } = await supabase.from('audit_logs').insert([
      { user_id: userId, user_name: userName, action, details },
    ]);
    return { error };
  },

  async getLogs() {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as AuditLog[];
  },

  async getLogsByUser(userId: string) {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as AuditLog[];
  },
};
