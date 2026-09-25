import { supabase } from '@/lib/supabase';
import type {
  TimetableOccurrence,
  NextClassData,
  AdminSchedulesResponse,
  RecurringSchedule,
  ScheduleException,
} from '@/types';

export const timetableService = {
  async getTimetableRange(startDate: string, endDate: string): Promise<TimetableOccurrence[]> {
    const { data, error } = await supabase.rpc('get_timetable_range', {
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch timetable');
    return (data.data as TimetableOccurrence[]) || [];
  },

  async getNextClass(): Promise<NextClassData | null> {
    const { data, error } = await supabase.rpc('get_next_class');
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch next class');
    return data.data as NextClassData | null;
  },

  async adminGetSchedules(courseId?: string): Promise<AdminSchedulesResponse> {
    const { data, error } = await supabase.rpc('admin_get_schedules', {
      p_course_id: courseId || null,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch schedules');
    return {
      success: true,
      schedules: (data.schedules as RecurringSchedule[]) || [],
      exceptions: (data.exceptions as ScheduleException[]) || [],
    };
  },

  async adminCreateSchedule(params: {
    course_offering_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    venue?: string;
    effective_start: string;
    effective_end: string;
  }): Promise<RecurringSchedule> {
    const { data, error } = await supabase.rpc('admin_create_recurring_schedule', {
      p_course_offering_id: params.course_offering_id,
      p_day_of_week: params.day_of_week,
      p_start_time: params.start_time,
      p_end_time: params.end_time,
      p_venue: params.venue || null,
      p_effective_start: params.effective_start,
      p_effective_end: params.effective_end,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to create schedule');
    return data.data as RecurringSchedule;
  },

  async adminUpdateSchedule(
    scheduleId: string,
    params: {
      day_of_week?: number;
      start_time?: string;
      end_time?: string;
      venue?: string;
      effective_start?: string;
      effective_end?: string;
      is_active?: boolean;
    }
  ): Promise<RecurringSchedule> {
    const { data, error } = await supabase.rpc('admin_update_recurring_schedule', {
      p_schedule_id: scheduleId,
      p_day_of_week: params.day_of_week ?? null,
      p_start_time: params.start_time ?? null,
      p_end_time: params.end_time ?? null,
      p_venue: params.venue ?? null,
      p_effective_start: params.effective_start ?? null,
      p_effective_end: params.effective_end ?? null,
      p_is_active: params.is_active ?? null,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to update schedule');
    return data.data as RecurringSchedule;
  },

  async adminCreateException(params: {
    schedule_id: string;
    occurrence_date: string;
    exception_type: string;
    new_date?: string;
    new_start_time?: string;
    new_end_time?: string;
    new_venue?: string;
    reason?: string;
  }): Promise<ScheduleException> {
    const { data, error } = await supabase.rpc('admin_create_exception', {
      p_schedule_id: params.schedule_id,
      p_occurrence_date: params.occurrence_date,
      p_exception_type: params.exception_type,
      p_new_date: params.new_date || null,
      p_new_start_time: params.new_start_time || null,
      p_new_end_time: params.new_end_time || null,
      p_new_venue: params.new_venue || null,
      p_reason: params.reason || null,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to create exception');
    return data.data as ScheduleException;
  },

  async adminDeleteException(exceptionId: string): Promise<void> {
    const { data, error } = await supabase.rpc('admin_delete_exception', {
      p_exception_id: exceptionId,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to delete exception');
  },

  async adminDeleteSchedule(scheduleId: string): Promise<void> {
    const { data, error } = await supabase.rpc('admin_delete_schedule', {
      p_schedule_id: scheduleId,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to delete schedule');
  },
};
