export type Role = 'student' | 'admin' | 'super_admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  index_number?: string;
  program?: string;
  level?: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  program_id: string;
  level: string;
  credits?: number;
  course_rep_id?: string;
  created_at: string;
}

export type SessionStatus = 'scheduled' | 'open' | 'closed' | 'cancelled';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface Session {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  attendance_code: string;
  qr_code: string;
  is_active: boolean;
  status: SessionStatus;
  attendance_open_time?: string;
  attendance_close_time?: string;
  late_threshold_minutes?: number;
  location_radius_meters?: number;
  venue?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  program_id: string;
  level: string;
  latitude?: number;
  longitude?: number;
  semester_id?: string;
  course_offering_id?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  session_id: string;
  timestamp: string;
  status: AttendanceStatus;
  student_latitude?: number;
  student_longitude?: number;
  location_verified?: boolean;
  modified_by?: string;
  modified_reason?: string;
  updated_at?: string;
}

export interface Setting {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}



export interface Notification {
  id: string;
  user_id: string;
  sender_id?: string;
  broadcast_id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  deleted?: boolean;
  created_at: string;
}

export interface Slide {
  id: string;
  course_id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  uploaded_by?: string;
  program_id?: string;
  created_at: string;
  semester_id?: string;
  course_offering_id?: string;
  courses?: { code: string; title: string };
  profiles?: { full_name: string };
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  due_date?: string;
  posted_by?: string;
  program_id?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  updated_at?: string;
  semester_id?: string;
  course_offering_id?: string;
  courses?: { code: string; title: string };
  profiles?: { full_name: string };
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  semesters?: Semester[];
}

export interface Semester {
  id: string;
  academic_year_id: string;
  name: string;
  semester_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  academic_years?: Pick<AcademicYear, 'id' | 'name'>;
}

export interface CourseOffering {
  id: string;
  course_id: string;
  semester_id: string;
  program_id: string;
  level: string;
  course_rep_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  courses?: { id: string; code: string; title: string };
  semesters?: Pick<Semester, 'id' | 'name' | 'semester_number'>;
  programs?: { id: string; name: string };
}

export interface CurrentAcademicPeriod {
  year: AcademicYear | null;
  semester: Semester | null;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  details?: string;
  created_at: string;
}

export interface DashboardStats {
  total_students: number;
  total_admins: number;
  total_sessions: number;
  active_sessions: number;
  total_courses: number;
  total_programs: number;
  attendance_rate: number;
  total_attendance: number;
}

export interface StudentStats {
  attendance_rate: number;
  classes_attended: number;
  total_courses: number;
  total_sessions: number;
}

// ===== Attendance analytics =====

export interface AttendanceRateSummary {
  held: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  not_marked: number;
  attended: number;
  missed: number;
  rate: number | null;
  students?: number;
  possible?: number;
}

export interface TrendPoint {
  bucket: string;
  label: string;
  held: number;
  attended: number;
  rate: number | null;
}

export interface AnalyticsAlert {
  type: 'below_threshold' | 'low_session' | 'repeated_absence' | 'decline';
  severity: 'warning' | 'info';
  count?: number;
  message: string;
  session_id?: string;
  title?: string;
  session_date?: string;
  rate?: number | null;
  student_id?: string;
  full_name?: string;
  index_number?: string;
  max_run?: number;
  delta?: number;
}

export interface StudentCourseAnalytics {
  course_id: string;
  code: string;
  title: string;
  held: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  not_marked: number;
  attended: number;
  rate: number | null;
}

export interface StudentRecentAttendance {
  id: string;
  session_id: string;
  title: string;
  course_id: string;
  course_code: string;
  course_title: string;
  session_date: string;
  start_time: string;
  status: string;
  timestamp: string;
}

export interface StudentAnalytics {
  success: boolean;
  error?: string;
  message?: string;
  threshold: number;
  overall: AttendanceRateSummary;
  by_course: StudentCourseAnalytics[];
  trend: TrendPoint[];
  trend_monthly: TrendPoint[];
  recent: StudentRecentAttendance[];
  last_5: { session_id: string; session_date: string; start_time: string; status: string }[];
  windows: {
    recent: { held: number; attended: number; rate: number | null } | null;
    previous: { held: number; attended: number; rate: number | null } | null;
  };
}

export interface CourseSessionAnalytics {
  session_id: string;
  title: string;
  session_date: string;
  start_time: string;
  status: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
  not_marked: number;
  attended: number;
  rate: number | null;
}

export interface CourseStudentAnalytics {
  student_id: string;
  full_name: string;
  index_number: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attended: number;
  held: number;
  rate: number | null;
  below_threshold: boolean;
}

export interface CourseAnalytics {
  success: boolean;
  error?: string;
  message?: string;
  threshold: number;
  course: { id: string; code: string; title: string; program_name: string };
  enrolled: number;
  held: number;
  possible: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  not_marked: number;
  attended: number;
  missed: number;
  rate: number | null;
  average_student_rate: number | null;
  by_session: CourseSessionAnalytics[];
  by_student: CourseStudentAnalytics[];
  trend: TrendPoint[];
  recent: CourseSessionAnalytics[];
  alerts: AnalyticsAlert[];
}

export interface AdminCourseOverview {
  course_id: string;
  code: string;
  title: string;
  enrolled: number;
  held: number;
  attended: number;
  possible: number;
  rate: number | null;
  below_threshold: number;
}

export interface AdminStudentBelowThreshold {
  student_id: string;
  full_name: string;
  index_number: string;
  held: number;
  attended: number;
  rate: number | null;
}

export interface AdminSessionOverview {
  session_id: string;
  title: string;
  session_date: string;
  start_time: string;
  status: string;
  course_id: string;
  course_code: string;
  course_title: string;
  present: number;
  late: number;
  absent: number;
  eligible: number;
  rate: number | null;
}

export interface AdminOverview {
  success: boolean;
  error?: string;
  message?: string;
  threshold: number;
  totals: AttendanceRateSummary;
  by_course: AdminCourseOverview[];
  students_below_threshold: AdminStudentBelowThreshold[];
  trend: TrendPoint[];
  recent: AdminSessionOverview[];
  alerts: AnalyticsAlert[];
}

export interface ProgramAnalytics {
  program_id: string;
  name: string;
  code: string;
  students: number;
  held: number;
  attended: number;
  possible: number;
  rate: number | null;
}

export interface LevelAnalytics {
  level: string;
  students: number;
  held: number;
  attended: number;
  possible: number;
  rate: number | null;
}

export interface SuperAdminCourseAnalytics {
  course_id: string;
  code: string;
  title: string;
  program_name: string;
  held: number;
  attended: number;
  possible: number;
  rate: number | null;
}

export interface SemesterAnalytics {
  semester_id: string | null;
  name: string | null;
  year_name: string | null;
  held: number;
  attended: number;
  possible: number;
  rate: number | null;
}

export interface SuperAdminAnalytics {
  success: boolean;
  error?: string;
  message?: string;
  threshold: number;
  totals: AttendanceRateSummary;
  by_program: ProgramAnalytics[];
  by_level: LevelAnalytics[];
  by_course: SuperAdminCourseAnalytics[];
  by_semester: SemesterAnalytics[];
  trend: TrendPoint[];
  recent: AdminSessionOverview[];
}

// ===== Timetable =====

export type ExceptionType = 'RESCHEDULED' | 'CANCELLED' | 'VENUE_CHANGED' | 'TIME_CHANGED' | 'SPECIAL_SESSION';

export interface RecurringSchedule {
  id: string;
  course_offering_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  effective_start: string;
  effective_end: string;
  is_active: boolean;
  program_id: string;
  level: string;
  created_by: string | null;
  created_at: string;
  course_id?: string;
  course_code?: string;
  course_title?: string;
  semester_id?: string;
  semester_name?: string;
  year_name?: string;
}

export interface ScheduleException {
  id: string;
  recurring_schedule_id: string;
  occurrence_date: string;
  exception_type: ExceptionType;
  new_date: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  new_venue: string | null;
  reason: string | null;
  changed_by: string | null;
  actor_name?: string | null;
  created_at: string;
}

export interface TimetableOccurrence {
  schedule_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  day_of_week: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  exception_type: string;
  is_cancelled: boolean;
  original_date: string;
  original_start_time: string;
  original_end_time: string;
  original_venue: string | null;
  reason: string | null;
  status: 'scheduled' | 'cancelled' | 'rescheduled';
}

export interface NextClassData {
  schedule_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  exception_type: string;
  reason: string | null;
}

export interface AdminSchedulesResponse {
  success: boolean;
  schedules: RecurringSchedule[];
  exceptions: ScheduleException[];
}
