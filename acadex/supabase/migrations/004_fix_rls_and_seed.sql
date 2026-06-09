-- Fix RLS infinite recursion and seed courses
-- Run this in your Supabase SQL Editor

-- 1. Helper function to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 2. Drop ALL existing policies
DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- 3. Recreate all policies

-- Profiles
CREATE POLICY "view_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "view_all_admin" ON profiles FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "update_super" ON profiles FOR UPDATE USING (get_user_role() = 'super_admin');
CREATE POLICY "delete_super" ON profiles FOR DELETE USING (get_user_role() = 'super_admin');
CREATE POLICY "insert_signup" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Programs
CREATE POLICY "view_all" ON programs FOR SELECT USING (true);
CREATE POLICY "manage_super" ON programs FOR ALL USING (get_user_role() = 'super_admin');

-- Courses
CREATE POLICY "view_all_courses" ON courses FOR SELECT USING (true);
CREATE POLICY "manage_super_courses" ON courses FOR ALL USING (get_user_role() = 'super_admin');

-- Enrollments
CREATE POLICY "view_own_enroll" ON enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "view_admin_enroll" ON enrollments FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "manage_super_enroll" ON enrollments FOR ALL USING (get_user_role() = 'super_admin');

-- Sessions
CREATE POLICY "view_all_sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "insert_admin_sessions" ON sessions FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "update_admin_sessions" ON sessions FOR UPDATE USING (get_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "delete_admin_sessions" ON sessions FOR DELETE USING (get_user_role() IN ('admin', 'super_admin'));

-- Attendance
CREATE POLICY "view_own_att" ON attendance FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "view_admin_att" ON attendance FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "insert_own_att" ON attendance FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "manage_super_att" ON attendance FOR ALL USING (get_user_role() = 'super_admin');

-- Notifications
CREATE POLICY "view_own_notif" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "insert_system_notif" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "update_own_notif" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Audit logs
CREATE POLICY "view_super_audit" ON audit_logs FOR SELECT USING (get_user_role() = 'super_admin');
CREATE POLICY "insert_system_audit" ON audit_logs FOR INSERT WITH CHECK (true);

-- 4. Seed courses for all programs
DO $$
DECLARE
  prog RECORD;
BEGIN
  FOR prog IN SELECT * FROM programs
  LOOP
    IF prog.code = 'BTECH-ICT' THEN
      INSERT INTO courses (code, title, program_id, level, credits) VALUES
        ('ICT101', 'Programming Fundamentals', prog.id, 'Level 100', 3),
        ('ICT102', 'Database Systems', prog.id, 'Level 100', 3),
        ('ICT103', 'Computer Networks', prog.id, 'Level 100', 3),
        ('ICT104', 'Web Development', prog.id, 'Level 100', 3),
        ('ICT105', 'Software Engineering', prog.id, 'Level 100', 3),
        ('ICT201', 'Advanced Programming', prog.id, 'Level 200', 3),
        ('ICT202', 'Cyber Security', prog.id, 'Level 200', 3),
        ('ICT203', 'Data Structures & Algorithms', prog.id, 'Level 200', 3),
        ('ICT204', 'Mobile App Development', prog.id, 'Level 200', 3),
        ('ICT205', 'Cloud Computing', prog.id, 'Level 200', 3)
      ON CONFLICT DO NOTHING;
    ELSIF prog.code = 'BTECH-CS' THEN
      INSERT INTO courses (code, title, program_id, level, credits) VALUES
        ('CS101', 'Introduction to CS', prog.id, 'Level 100', 3),
        ('CS102', 'Discrete Mathematics', prog.id, 'Level 100', 3),
        ('CS103', 'Digital Logic', prog.id, 'Level 100', 3),
        ('CS104', 'Computer Architecture', prog.id, 'Level 100', 3),
        ('CS201', 'Data Structures', prog.id, 'Level 200', 3),
        ('CS202', 'Operating Systems', prog.id, 'Level 200', 3),
        ('CS203', 'Theory of Computation', prog.id, 'Level 200', 3),
        ('CS204', 'Computer Graphics', prog.id, 'Level 200', 3)
      ON CONFLICT DO NOTHING;
    ELSIF prog.code = 'HND-NET' THEN
      INSERT INTO courses (code, title, program_id, level, credits) VALUES
        ('NET101', 'Network Fundamentals', prog.id, 'Level 100', 3),
        ('NET102', 'Routing & Switching', prog.id, 'Level 100', 3),
        ('NET103', 'Network Cabling', prog.id, 'Level 100', 3),
        ('NET201', 'Network Security', prog.id, 'Level 200', 3),
        ('NET202', 'Wireless Networks', prog.id, 'Level 200', 3),
        ('NET203', 'Cloud Infrastructure', prog.id, 'Level 200', 3)
      ON CONFLICT DO NOTHING;
    ELSIF prog.code = 'HND-CS' THEN
      INSERT INTO courses (code, title, program_id, level, credits) VALUES
        ('HCS101', 'Intro to Programming', prog.id, 'Level 100', 3),
        ('HCS102', 'Mathematics for CS', prog.id, 'Level 100', 3),
        ('HCS103', 'Web Technologies', prog.id, 'Level 100', 3),
        ('HCS201', 'Database Management', prog.id, 'Level 200', 3),
        ('HCS202', 'Software Development', prog.id, 'Level 200', 3),
        ('HCS203', 'IT Project Management', prog.id, 'Level 200', 3)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
