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
  created_by: string;
  created_at: string;
  program_id: string;
  level: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  session_id: string;
  timestamp: string;
  status: 'present' | 'absent' | 'late';
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
  courses?: { code: string; title: string };
  profiles?: { full_name: string };
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
