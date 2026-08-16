import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { timetableService } from '@/services/timetableService';
import type { TimetableOccurrence, NextClassData } from '@/types';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

function isPast(dateStr: string, timeStr: string): boolean {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m, 0, 0);
  return d < now;
}

function getNextOccurrence(occurrences: TimetableOccurrence[]): NextClassData | null {
  const now = new Date();
  const upcoming = occurrences
    .filter(o => {
      const d = new Date(o.date);
      const [h, m] = o.start_time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      return d > now && !o.is_cancelled;
    })
    .sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      const [ha, ma] = a.start_time.split(':').map(Number);
      const [hb, mb] = b.start_time.split(':').map(Number);
      da.setHours(ha, ma, 0, 0);
      db.setHours(hb, mb, 0, 0);
      return da.getTime() - db.getTime();
    });
  return upcoming[0] || null;
}

const EXCEPTION_COLORS: Record<string, string> = {
  RESCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  VENUE_CHANGED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  TIME_CHANGED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  SPECIAL_SESSION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const EXCEPTION_ICONS: Record<string, React.ReactNode> = {
  RESCHEDULED: <Calendar className="w-3 h-3" />,
  CANCELLED: <XCircle className="w-3 h-3" />,
  VENUE_CHANGED: <MapPin className="w-3 h-3" />,
  TIME_CHANGED: <Clock className="w-3 h-3" />,
  SPECIAL_SESSION: <AlertTriangle className="w-3 h-3" />,
};

export function StudentTimetablePage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [occurrences, setOccurrences] = useState<TimetableOccurrence[]>([]);
  const [nextClass, setNextClass] = useState<NextClassData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      const [data, nc] = await Promise.all([
        timetableService.getTimetableRange(formatDate(weekStart), formatDate(end)),
        timetableService.getNextClass(),
      ]);
      setOccurrences(data);
      setNextClass(nc);
    } catch {
      toast.error('Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDay = days.map(d => {
    const dateStr = formatDate(d);
    return {
      date: d,
      dateStr,
      label: DAY_SHORT[d.getDay()],
      fullLabel: DAY_NAMES[d.getDay()],
      occurrences: occurrences
        .filter(o => o.date === dateStr)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    };
  });

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToday = () => setWeekStart(getWeekStart(new Date()));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {nextClass && (
        <Card className="border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-600 dark:text-primary-400">Next Class</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {nextClass.course_code} — {nextClass.course_title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(nextClass.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  {' • '}
                  {formatTime(nextClass.start_time)} – {formatTime(nextClass.end_time)}
                  {nextClass.venue && ` • ${nextClass.venue}`}
                </p>
                {nextClass.exception_type !== 'REGULAR' && (
                  <Badge className={`mt-1 ${EXCEPTION_COLORS[nextClass.exception_type] || ''}`}>
                    {nextClass.exception_type.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {byDay.map((day) => (
            <div
              key={day.dateStr}
              className={`rounded-xl border p-3 min-h-[120px] ${
                isToday(day.dateStr)
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="text-center mb-3">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{day.label}</p>
                <p className={`text-lg font-bold ${
                  isToday(day.dateStr)
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {day.date.getDate()}
                </p>
              </div>

              {day.occurrences.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">No classes</p>
              ) : (
                <div className="space-y-2">
                  {day.occurrences.map((occ, i) => {
                    const past = isPast(occ.date, occ.start_time);
                    return (
                      <motion.div
                        key={`${occ.schedule_id}-${occ.date}-${i}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`p-2 rounded-lg text-xs ${
                          occ.is_cancelled
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 opacity-60'
                            : past
                              ? 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                              : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm'
                        }`}
                      >
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {occ.course_code}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 truncate">
                          {formatTime(occ.start_time)} – {formatTime(occ.end_time)}
                        </p>
                        {occ.venue && (
                          <p className="text-gray-400 dark:text-gray-500 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />{occ.venue}
                          </p>
                        )}
                        {occ.exception_type !== 'REGULAR' && (
                          <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${EXCEPTION_COLORS[occ.exception_type] || ''}`}>
                            {EXCEPTION_ICONS[occ.exception_type]}
                            {occ.exception_type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {occ.is_cancelled && (
                          <span className="text-red-500 font-medium mt-1 block">Cancelled</span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
