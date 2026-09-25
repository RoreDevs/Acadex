import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Plus, Trash2, Edit2, Clock, MapPin,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { courseService } from '@/services/courseService';
import { academicPeriodService } from '@/services/academicPeriodService';
import { timetableService } from '@/services/timetableService';
import type {
  RecurringSchedule,
  ScheduleException,
  CourseOffering,
  Course,
} from '@/types';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EXCEPTION_TYPES = [
  { value: 'RESCHEDULED', label: 'Reschedule (move to new date/time)' },
  { value: 'CANCELLED', label: 'Cancel this occurrence' },
  { value: 'VENUE_CHANGED', label: 'Change venue only' },
  { value: 'TIME_CHANGED', label: 'Change time only' },
  { value: 'SPECIAL_SESSION', label: 'Special session (different venue/time)' },
];

interface ScheduleWithMeta extends RecurringSchedule {
  _exceptions?: ScheduleException[];
}

export function AdminTimetablePage() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleWithMeta[]>([]);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [loading, setLoading] = useState(true);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringSchedule | null>(null);
  const [formCourseOfferingId, setFormCourseOfferingId] = useState('');
  const [formDayOfWeek, setFormDayOfWeek] = useState('1');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formVenue, setFormVenue] = useState('');
  const [formEffectiveStart, setFormEffectiveStart] = useState('');
  const [formEffectiveEnd, setFormEffectiveEnd] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [excFormScheduleId, setExcFormScheduleId] = useState('');
  const [excFormDate, setExcFormDate] = useState('');
  const [excFormType, setExcFormType] = useState('CANCELLED');
  const [excFormNewDate, setExcFormNewDate] = useState('');
  const [excFormNewStart, setExcFormNewStart] = useState('');
  const [excFormNewEnd, setExcFormNewEnd] = useState('');
  const [excFormNewVenue, setExcFormNewVenue] = useState('');
  const [excFormReason, setExcFormReason] = useState('');
  const [excFormLoading, setExcFormLoading] = useState(false);

  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringSchedule | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [scheduleData, sem] = await Promise.all([
        timetableService.adminGetSchedules(),
        academicPeriodService.getCurrentPeriod(),
      ]);
      setSchedules(scheduleData.schedules.map(s => ({
        ...s,
        _exceptions: scheduleData.exceptions.filter(e => e.recurring_schedule_id === s.id),
      })));
      if (sem?.semester) {
        const offs = await academicPeriodService.getOfferingsBySemester(sem.semester.id);
        setOfferings(offs.filter(o => o.program_id === profile.program && o.level === profile.level));
      }
    } catch {
      toast.error('Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetScheduleForm = () => {
    setFormCourseOfferingId('');
    setFormDayOfWeek('1');
    setFormStartTime('08:00');
    setFormEndTime('10:00');
    setFormVenue('');
    setFormEffectiveStart('');
    setFormEffectiveEnd('');
    setEditingSchedule(null);
  };

  const openCreateSchedule = () => { resetScheduleForm(); setShowScheduleForm(true); };

  const openEditSchedule = (s: RecurringSchedule) => {
    setFormCourseOfferingId(s.course_offering_id);
    setFormDayOfWeek(String(s.day_of_week));
    setFormStartTime(s.start_time.substring(0, 5));
    setFormEndTime(s.end_time.substring(0, 5));
    setFormVenue(s.venue || '');
    setFormEffectiveStart(s.effective_start);
    setFormEffectiveEnd(s.effective_end);
    setEditingSchedule(s);
    setShowScheduleForm(true);
  };

  const submitSchedule = async () => {
    if (!formCourseOfferingId || !formEffectiveStart || !formEffectiveEnd) {
      toast.error('Please fill all required fields');
      return;
    }
    setFormLoading(true);
    try {
      if (editingSchedule) {
        await timetableService.adminUpdateSchedule(editingSchedule.id, {
          day_of_week: Number(formDayOfWeek),
          start_time: formStartTime,
          end_time: formEndTime,
          venue: formVenue || undefined,
          effective_start: formEffectiveStart,
          effective_end: formEffectiveEnd,
        });
        toast.success('Schedule updated');
      } else {
        await timetableService.adminCreateSchedule({
          course_offering_id: formCourseOfferingId,
          day_of_week: Number(formDayOfWeek),
          start_time: formStartTime,
          end_time: formEndTime,
          venue: formVenue || undefined,
          effective_start: formEffectiveStart,
          effective_end: formEffectiveEnd,
        });
        toast.success('Schedule created');
      }
      setShowScheduleForm(false);
      resetScheduleForm();
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save schedule');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleActive = async (s: RecurringSchedule) => {
    try {
      await timetableService.adminUpdateSchedule(s.id, { is_active: !s.is_active });
      toast.success(s.is_active ? 'Schedule deactivated' : 'Schedule activated');
      await loadData();
    } catch {
      toast.error('Failed to toggle schedule');
    }
  };

  const openCreateException = (scheduleId: string, date: string) => {
    setExcFormScheduleId(scheduleId);
    setExcFormDate(date);
    setExcFormType('CANCELLED');
    setExcFormNewDate('');
    setExcFormNewStart('');
    setExcFormNewEnd('');
    setExcFormNewVenue('');
    setExcFormReason('');
    setShowExceptionForm(true);
  };

  const submitException = async () => {
    if (!excFormScheduleId || !excFormDate || !excFormType) {
      toast.error('Please fill all required fields');
      return;
    }
    setExcFormLoading(true);
    try {
      await timetableService.adminCreateException({
        schedule_id: excFormScheduleId,
        occurrence_date: excFormDate,
        exception_type: excFormType,
        new_date: excFormNewDate || undefined,
        new_start_time: excFormNewStart || undefined,
        new_end_time: excFormNewEnd || undefined,
        new_venue: excFormNewVenue || undefined,
        reason: excFormReason || undefined,
      });
      toast.success('Exception created');
      setShowExceptionForm(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create exception');
    } finally {
      setExcFormLoading(false);
    }
  };

  const deleteException = async (id: string) => {
    try {
      await timetableService.adminDeleteException(id);
      toast.success('Exception removed');
      await loadData();
    } catch {
      toast.error('Failed to delete exception');
    }
  };

  const deleteSchedule = async () => {
    if (!deleteTarget) return;
    try {
      await timetableService.adminDeleteSchedule(deleteTarget.id);
      toast.success('Schedule deleted');
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete schedule');
    }
  };

  const requiresNewDate = excFormType === 'RESCHEDULED' || excFormType === 'SPECIAL_SESSION';
  const requiresNewVenue = excFormType === 'VENUE_CHANGED' || excFormType === 'RESCHEDULED' || excFormType === 'SPECIAL_SESSION';
  const requiresNewTime = excFormType === 'TIME_CHANGED' || excFormType === 'RESCHEDULED' || excFormType === 'SPECIAL_SESSION';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Timetable Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage recurring schedules and one-time exceptions
          </p>
        </div>
        <Button onClick={openCreateSchedule} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Schedule
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No schedules yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first recurring schedule to get started</p>
            <Button onClick={openCreateSchedule} className="flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" /> New Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map(s => {
            const isExpanded = expandedSchedule === s.id;
            const exc = s._exceptions || [];
            return (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {s.course_code || 'Course'} — {s.course_title || ''}
                        </h3>
                        {!s.is_active && <Badge variant="outline" className="text-gray-400">Inactive</Badge>}
                        {exc.length > 0 && (
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            {exc.length} exception{exc.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />{DAY_NAMES[s.day_of_week]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {s.start_time?.substring(0, 5)} – {s.end_time?.substring(0, 5)}
                        </span>
                        {s.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />{s.venue}
                          </span>
                        )}
                        <span className="text-xs">
                          {s.effective_start} → {s.effective_end}
                        </span>
                      </div>
                      {s.semester_name && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {s.semester_name} • {s.year_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(s)}
                        title={s.is_active ? 'Deactivate' : 'Activate'}>
                        {s.is_active
                          ? <ToggleRight className="w-5 h-5 text-green-500" />
                          : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditSchedule(s)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)} title="Delete schedule">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={() => setExpandedSchedule(isExpanded ? null : s.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Exceptions</h4>
                        <Button variant="outline" size="sm"
                          onClick={() => openCreateException(s.id, new Date().toISOString().split('T')[0])}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Exception
                        </Button>
                      </div>

                      {exc.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">No exceptions</p>
                      ) : (
                        <div className="space-y-2">
                          {exc.map(e => (
                            <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                              <Badge className={
                                e.exception_type === 'CANCELLED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : e.exception_type === 'RESCHEDULED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : e.exception_type === 'VENUE_CHANGED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : e.exception_type === 'TIME_CHANGED' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                              }>
                                {e.exception_type.replace(/_/g, ' ')}
                              </Badge>
                              <div className="flex-1 min-w-0 text-sm">
                                <p className="text-gray-900 dark:text-gray-100">
                                  {new Date(e.occurrence_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                {e.new_date && (
                                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                                    → {new Date(e.new_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    {e.new_start_time && ` ${e.new_start_time.substring(0, 5)}`}
                                    {e.new_venue && ` @ ${e.new_venue}`}
                                  </p>
                                )}
                                {e.reason && (
                                  <p className="text-gray-400 dark:text-gray-500 text-xs italic">"{e.reason}"</p>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => deleteException(e.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showScheduleForm} onOpenChange={setShowScheduleForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'New Recurring Schedule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Course</Label>
              <Select value={formCourseOfferingId} onValueChange={setFormCourseOfferingId}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {offerings.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.courses?.code} — {o.courses?.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day of Week</Label>
              <Select value={formDayOfWeek} onValueChange={setFormDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Time</Label><Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} /></div>
              <div><Label>End Time</Label><Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} /></div>
            </div>
            <div><Label>Venue</Label><Input value={formVenue} onChange={e => setFormVenue(e.target.value)} placeholder="e.g. Room 101" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Effective Start</Label><Input type="date" value={formEffectiveStart} onChange={e => setFormEffectiveStart(e.target.value)} /></div>
              <div><Label>Effective End</Label><Input type="date" value={formEffectiveEnd} onChange={e => setFormEffectiveEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleForm(false)}>Cancel</Button>
            <Button onClick={submitSchedule} disabled={formLoading}>
              {formLoading ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExceptionForm} onOpenChange={setShowExceptionForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Schedule Exception</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Exception Type</Label>
              <Select value={excFormType} onValueChange={setExcFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXCEPTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {requiresNewDate && (
              <div><Label>New Date</Label><Input type="date" value={excFormNewDate} onChange={e => setExcFormNewDate(e.target.value)} /></div>
            )}
            {requiresNewTime && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>New Start Time</Label><Input type="time" value={excFormNewStart} onChange={e => setExcFormNewStart(e.target.value)} /></div>
                <div><Label>New End Time</Label><Input type="time" value={excFormNewEnd} onChange={e => setExcFormNewEnd(e.target.value)} /></div>
              </div>
            )}
            {requiresNewVenue && (
              <div><Label>New Venue</Label><Input value={excFormNewVenue} onChange={e => setExcFormNewVenue(e.target.value)} placeholder="e.g. Room 202" /></div>
            )}
            <div><Label>Reason (optional)</Label><Input value={excFormReason} onChange={e => setExcFormReason(e.target.value)} placeholder="Why this change?" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExceptionForm(false)}>Cancel</Button>
            <Button onClick={submitException} disabled={excFormLoading}>
              {excFormLoading ? 'Saving...' : 'Create Exception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Schedule"
        description={deleteTarget
          ? `Permanently delete the ${deleteTarget.course_code || 'schedule'} class on ${DAY_NAMES[deleteTarget.day_of_week]} (${deleteTarget.start_time?.substring(0, 5)} – ${deleteTarget.end_time?.substring(0, 5)})? All of its exceptions will also be removed. This cannot be undone.`
          : ''}
        onConfirm={deleteSchedule}
        confirmText="Delete Schedule"
        confirmVariant="destructive"
      />
    </motion.div>
  );
}
