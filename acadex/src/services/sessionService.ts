import { supabase } from '@/lib/supabase';
import type { Session } from '@/types';

function generateAttendanceCode(courseCode: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${courseCode}-${random}`;
}

export const sessionService = {
  async createSession(data: {
    course_id: string;
    title: string;
    description?: string;
    session_date: string;
    start_time: string;
    end_time: string;
    program_id: string;
    level: string;
    course_code: string;
  }) {
    let attendance_code = generateAttendanceCode(data.course_code);
    let isUnique = false;
    while (!isUnique) {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('attendance_code', attendance_code)
        .maybeSingle();
      if (!existing) {
        isUnique = true;
      } else {
        attendance_code = generateAttendanceCode(data.course_code);
      }
    }

    const qrCode = `${window.location.origin}/attendance/${attendance_code}`;

    const { data: session, error } = await supabase
      .from('sessions')
      .insert([
        {
          course_id: data.course_id,
          title: data.title,
          description: data.description,
          session_date: data.session_date,
          start_time: data.start_time,
          end_time: data.end_time,
          attendance_code,
          qr_code: qrCode,
          is_active: true,
          program_id: data.program_id,
          level: data.level,
        },
      ])
      .select()
      .single();

    return { data: session as Session | null, error };
  },

  async getSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*, courses(title, code)')
      .order('session_date', { ascending: false });
    return (data || []) as any[];
  },

  async getUpcomingSessions(limit = 10) {
    const now = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('sessions')
      .select('*, courses(title, code)')
      .gte('session_date', now)
      .eq('is_active', true)
      .order('session_date', { ascending: true })
      .limit(limit);
    return (data || []) as any[];
  },

  async getSessionsByProgram(program: string, level: string) {
    const { data } = await supabase
      .from('sessions')
      .select('*, courses(title, code)')
      .eq('program_id', program)
      .eq('level', level)
      .order('session_date', { ascending: false });
    return (data || []) as any[];
  },

  async getSessionById(id: string) {
    const { data } = await supabase
      .from('sessions')
      .select('*, courses(title, code)')
      .eq('id', id)
      .single();
    return data as any;
  },

  async getSessionByCode(code: string) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, courses(title, code)')
      .eq('attendance_code', code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    if (data.is_active) {
      const [y, m, d] = data.session_date.split('-').map(Number);
      const [hh, mm, ss = '0'] = data.end_time.split(':');
      const sessionEnd = new Date(y, m - 1, d, +hh, +mm, +ss);
      if (new Date() > sessionEnd) {
        await supabase.from('sessions').update({ is_active: false }).eq('id', data.id);
        data.is_active = false;
      }
    }

    return data as any;
  },

  async updateSession(id: string, updates: Partial<Session>) {
    const { error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id);
    return { error };
  },

  async endSession(id: string) {
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', id);
    return { error };
  },

  async deleteSession(id: string) {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);
    return { error };
  },

  async getActiveSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*, courses(title, code)')
      .eq('is_active', true)
      .order('session_date', { ascending: false });
    return (data || []) as any[];
  },
};
