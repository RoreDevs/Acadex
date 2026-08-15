import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types';

export const auditService = {
  // Identity (user_id, user_name) is set server-side by the SECURITY DEFINER RPC.
  async logAction(_userId: string, _userName: string, action: string, details?: string) {
    const { error } = await supabase.rpc('log_audit', {
      p_action: action,
      p_details: details ?? null,
    });
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
