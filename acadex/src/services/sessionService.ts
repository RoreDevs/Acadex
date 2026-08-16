import { supabase } from '@/lib/supabase';
import type { Session } from '@/types';

function generateAttendanceCode(courseCode: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(values[i] % chars.length);
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
    created_by?: string;
    latitude?: number;
    longitude?: number;
    semester_id?: string;
    course_offering_id?: string;
    venue?: string;
    attendance_open_time?: string;
    attendance_close_time?: string;
    late_threshold_minutes?: number;
    location_radius_meters?: number;
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
          status: 'scheduled',
          is_active: true,
          program_id: data.program_id,
          level: data.level,
          created_by: data.created_by ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          semester_id: data.semester_id ?? null,
          course_offering_id: data.course_offering_id ?? null,
          venue: data.venue ?? null,
          attendance_open_time: data.attendance_open_time ?? null,
          attendance_close_time: data.attendance_close_time ?? null,
          late_threshold_minutes: data.late_threshold_minutes ?? null,
          location_radius_meters: data.location_radius_meters ?? null,
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
    return (data || null) as any;
  },

  async updateSession(id: string, updates: Partial<Session>) {
    const { error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id);
    return { error };
  },

  async endSession(id: string) {
    return this.setSessionStatus(id, 'closed');
  },

  async setSessionStatus(id: string, status: 'open' | 'closed' | 'cancelled') {
    const { data, error } = await supabase.rpc('admin_set_session_status', {
      p_session_id: id,
      p_status: status,
    });
    if (error) return { error };
    const result = data as any;
    if (!result?.success) {
      return { error: { message: result?.message || 'Failed to update session.' } };
    }
    return { error: null };
  },

  async regenerateCode(id: string) {
    const { data, error } = await supabase.rpc('admin_regenerate_session_code', {
      p_session_id: id,
    });
    if (error) return { data: null, error };
    const result = data as any;
    if (!result?.success) {
      return { data: null, error: { message: result?.message || 'Failed to regenerate code.' } };
    }
    return { data: result, error: null };
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
