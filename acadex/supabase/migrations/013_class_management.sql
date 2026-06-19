-- Add class column to sessions (nullable for backward compatibility)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS class TEXT CHECK (class IN ('A', 'B'));

-- Create table for persisting admin class overrides
CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  class TEXT NOT NULL CHECK (class IN ('A', 'B')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, program_id)
);

ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;

-- Students can read their own class
CREATE POLICY "view_own_class" ON student_classes FOR SELECT USING (student_id = auth.uid());

-- Admins/super_admins can read all
CREATE POLICY "view_all_admin_class" ON student_classes FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));

-- Admins/super_admins can upsert
CREATE POLICY "upsert_admin_class" ON student_classes FOR ALL USING (get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'super_admin'));

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_student_classes_student ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_program ON student_classes(program_id);
