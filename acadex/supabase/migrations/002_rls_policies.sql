-- Row Level Security Policies for Acadex
-- Run AFTER 001_initial_schema.sql

-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Allow insert during signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Programs policies
CREATE POLICY "Everyone can view programs"
  ON programs FOR SELECT
  USING (TRUE);

CREATE POLICY "Super admins can manage programs"
  ON programs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 4. Courses policies
CREATE POLICY "Everyone can view courses"
  ON courses FOR SELECT
  USING (TRUE);

CREATE POLICY "Super admins can manage courses"
  ON courses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 5. Enrollments policies
CREATE POLICY "Students can view own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Admins can view enrollments in their program"
  ON enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can manage enrollments"
  ON enrollments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 6. Sessions policies
CREATE POLICY "Everyone can view sessions"
  ON sessions FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update own sessions"
  ON sessions FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admins can delete own sessions"
  ON sessions FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 7. Attendance policies
CREATE POLICY "Students can view own attendance"
  ON attendance FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Admins can view attendance in their program"
  ON attendance FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Students can insert own attendance"
  ON attendance FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Super admins can manage attendance"
  ON attendance FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 8. Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- 9. Audit logs policies
CREATE POLICY "Super admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (TRUE);
