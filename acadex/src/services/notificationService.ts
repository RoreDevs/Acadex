import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';

export const notificationService = {
  async getNotifications(userId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as Notification[];
  },

  async getUnreadCount(userId: string) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    return count ?? 0;
  },

  async getAllNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as any[];
  },

  async createNotification(data: {
    user_id: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) {
    const { error } = await supabase.from('notifications').insert([
      { ...data, type: data.type || 'info' },
    ]);
    return { error };
  },

  async sendToAllUsers(data: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id');
    if (!users || users.length === 0) return { error: null };
    const notifications = users.map((u) => ({
      user_id: u.id,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    return { error, count: notifications.length };
  },

  async markAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    return { error };
  },

  async markAllAsRead(userId?: string) {
    let query = supabase.from('notifications').update({ read: true }).is('read', false);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    return { error };
  },

  async deleteNotification(id: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    return { error };
  },
};
