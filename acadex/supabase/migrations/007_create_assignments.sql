-- Create assignments table for course assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  posted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_program ON assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_assignments_posted_by ON assignments(posted_by);
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON assignments(created_at DESC);

-- RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view assignments"
  ON assignments FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins and super admins can insert assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Admins can update assignments in their program"
  ON assignments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') OR
    (
      posted_by = auth.uid() AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND program = assignments.program_id)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') OR
    (
      posted_by = auth.uid() AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND program = assignments.program_id)
    )
  );

CREATE POLICY "Admins can delete assignments in their program"
  ON assignments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') OR
    (
      posted_by = auth.uid() AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND program = assignments.program_id)
    )
  );
