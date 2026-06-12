import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';

export const notificationService = {
  async getNotifications(userId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .or('deleted.is.null,deleted.neq.true')
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as Notification[];
  },

  async getUnreadCount(userId: string) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
      .or('deleted.is.null,deleted.neq.true');
    return count ?? 0;
  },

  async getAllNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles!notifications_user_id_fkey(full_name)')
      .or('deleted.is.null,deleted.neq.true')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as any[];
  },

  async createNotification(data: {
    user_id: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    sender_id?: string;
    broadcast_id?: string;
  }) {
    const { error } = await supabase.from('notifications').insert([
      { ...data, type: data.type || 'info', deleted: false },
    ]);
    return { error };
  },

  async sendToAllUsers(data: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    sender_id: string;
  }) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id');
    if (!users || users.length === 0) return { error: null, count: 0 };
    const broadcastId = crypto.randomUUID();
    const notifications = users.map((u) => ({
      user_id: u.id,
      sender_id: data.sender_id,
      broadcast_id: broadcastId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      deleted: false,
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    return { error, count: notifications.length, broadcast_id: broadcastId };
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

  async getSentBroadcasts(senderId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('broadcast_id, title, message, type, created_at')
      .eq('sender_id', senderId)
      .not('broadcast_id', 'is', null)
      .or('deleted.is.null,deleted.neq.true')
      .order('created_at', { ascending: false });
    if (!data) return [];
    const map = new Map<string, any>();
    for (const n of data) {
      if (!map.has(n.broadcast_id)) {
        map.set(n.broadcast_id, {
          broadcast_id: n.broadcast_id,
          title: n.title,
          message: n.message,
          type: n.type,
          created_at: n.created_at,
        });
      }
    }
    const broadcasts = Array.from(map.values());
    for (const b of broadcasts) {
      const { count: total } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('broadcast_id', b.broadcast_id);
      const { count: readCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('broadcast_id', b.broadcast_id)
        .eq('read', true);
      b.total_count = total ?? 0;
      b.read_count = readCount ?? 0;
    }
    return broadcasts;
  },

  async softDeleteBroadcast(broadcastId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ deleted: true })
      .eq('broadcast_id', broadcastId);
    return { error };
  },

  async updateBroadcast(broadcastId: string, data: {
    title?: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) {
    const updateData: Record<string, any> = {};
    if (data.title) updateData.title = data.title;
    if (data.message) updateData.message = data.message;
    if (data.type) updateData.type = data.type;
    const { error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('broadcast_id', broadcastId);
    return { error };
  },

  async getBroadcastDetails(broadcastId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles!notifications_user_id_fkey(full_name, email, role)')
      .eq('broadcast_id', broadcastId)
      .order('created_at', { ascending: false });
    return (data || []) as any[];
  },

  async getTrashBroadcasts(senderId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('broadcast_id, title, message, type, created_at')
      .eq('sender_id', senderId)
      .not('broadcast_id', 'is', null)
      .eq('deleted', true)
      .order('created_at', { ascending: false });
    if (!data) return [];
    const map = new Map<string, any>();
    for (const n of data) {
      if (!map.has(n.broadcast_id)) {
        map.set(n.broadcast_id, {
          broadcast_id: n.broadcast_id,
          title: n.title,
          message: n.message,
          type: n.type,
          created_at: n.created_at,
        });
      }
    }
    const broadcasts = Array.from(map.values());
    for (const b of broadcasts) {
      const { count: total } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('broadcast_id', b.broadcast_id);
      b.total_count = total ?? 0;
    }
    return broadcasts;
  },

  async restoreBroadcast(broadcastId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ deleted: false })
      .eq('broadcast_id', broadcastId);
    return { error };
  },

  async permanentlyDeleteBroadcast(broadcastId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('broadcast_id', broadcastId);
    return { error };
  },
};
