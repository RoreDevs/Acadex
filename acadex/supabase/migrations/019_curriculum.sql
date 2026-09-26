-- 019: Reusable Curriculum (program + level + semester_number -> courses)
-- ============================================================
-- Adds the ONE missing concept: a year-independent curriculum mapping.
--
--   courses            = reusable course definitions (identity, catalog)
--   curriculum_courses = WHERE a course belongs (program/level/semester_number)
--   course_offerings   = a course running for one cohort (semester instance)
--   semesters          = year-specific Semester 1 / Semester 2 buckets
--
-- A new academic year reuses the curriculum automatically: offerings for
-- the new semester are materialized from the curriculum (see
-- ensure_semester_offerings) instead of re-entering courses.
--
-- Curriculum edits only affect FUTURE materializations. Existing
-- offerings, attendance, assignments, announcements, slides, sessions
-- and timetable records are NEVER touched by this migration.
--
-- Backward-safe + idempotent: safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Curriculum mapping table
-- ============================================================
CREATE TABLE IF NOT EXISTS curriculum_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 6),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_curriculum_course UNIQUE (program_id, level, semester_number, course_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_program_level_sem
  ON curriculum_courses(program_id, level, semester_number);
CREATE INDEX IF NOT EXISTS idx_curriculum_course
  ON curriculum_courses(course_id);

-- ============================================================
-- 2. Row Level Security
-- ============================================================
ALTER TABLE curriculum_courses ENABLE ROW LEVEL SECURITY;

-- Students read only their own program + level curriculum.
-- Admins read their own program curriculum.
-- Super admins read everything (curriculum management UI).
DROP POLICY IF EXISTS "view_curriculum" ON curriculum_courses;
CREATE POLICY "view_curriculum" ON curriculum_courses FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() = 'admin'
      AND program_id::text = (SELECT program FROM profiles WHERE id = auth.uid())
    )
    OR (
      get_user_role() = 'student'
      AND program_id::text = (SELECT program FROM profiles WHERE id = auth.uid())
      AND level = (SELECT level FROM profiles WHERE id = auth.uid())
    )
  );

-- Only super admins may change the master curriculum.
DROP POLICY IF EXISTS "manage_curriculum" ON curriculum_courses;
CREATE POLICY "manage_curriculum" ON curriculum_courses FOR ALL
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

-- ============================================================
-- 3. Backfill curriculum from existing offerings (non-destructive)
-- ============================================================
-- Every existing offering already ties (course, program, level) to a
-- year-specific semester; lift the semester_number out of it so the
-- mapping survives into future academic years. Existing offerings,
-- courses, sessions, attendance, etc. are left untouched.
INSERT INTO curriculum_courses (program_id, level, semester_number, course_id)
SELECT DISTINCT co.program_id, co.level, s.semester_number, co.course_id
FROM course_offerings co
JOIN semesters s ON s.id = co.semester_id
ON CONFLICT DO NOTHING;

-- NOTE (ambiguity report, read-only): courses that have NO offering in
-- any semester cannot be mapped to a semester_number automatically.
-- Configure them in the Super Admin Curriculum page instead of guessing.
--   SELECT c.id, c.code, c.title, c.program_id, c.level
--   FROM courses c
--   LEFT JOIN course_offerings co ON co.course_id = c.id
--   WHERE co.id IS NULL;

-- ============================================================
-- 4. Materialize offerings for a semester from the curriculum
-- ============================================================
-- Creates the missing course_offerings for one semester so a new
-- academic year/semester automatically serves the configured
-- curriculum. Insert-only: never updates or deletes anything, so
-- historical contexts are impossible to disturb. Safe to call often.
CREATE OR REPLACE FUNCTION public.ensure_semester_offerings(p_semester_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sem RECORD;
  v_created INT;
BEGIN
  SELECT * INTO v_sem FROM semesters WHERE id = p_semester_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Semester not found.');
  END IF;

  INSERT INTO course_offerings (course_id, semester_id, program_id, level, is_active)
  SELECT cc.course_id, p_semester_id, cc.program_id, cc.level, TRUE
  FROM curriculum_courses cc
  WHERE cc.semester_number = v_sem.semester_number
    AND NOT EXISTS (
      SELECT 1 FROM course_offerings co
      WHERE co.semester_id = p_semester_id
        AND co.course_id = cc.course_id
        AND co.program_id = cc.program_id
        AND co.level = cc.level
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'created', v_created);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_semester_offerings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_semester_offerings(UUID) TO authenticated;
