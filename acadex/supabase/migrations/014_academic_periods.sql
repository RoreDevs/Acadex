-- 014: Academic Years, Semesters, and Course Offerings
-- ============================================================
-- Backward-safe: adds NEW tables + nullable scoping columns on
-- existing tables. Does NOT rewrite, drop, or reset any existing
-- data. All existing sessions/assignments/slides are preserved and
-- backfilled into a legacy academic period.
--
-- Idempotent: safe to re-run against an already-migrated database.
-- ============================================================

-- ============================================================
-- 1. Academic years
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_academic_year_dates CHECK (end_date >= start_date)
);

-- ============================================================
-- 2. Semesters
-- ============================================================
CREATE TABLE IF NOT EXISTS semesters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 6),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_semester_dates CHECK (end_date >= start_date),
  CONSTRAINT uq_semester_number UNIQUE (academic_year_id, semester_number),
  CONSTRAINT uq_semester_name UNIQUE (academic_year_id, name)
);

-- Only one academic year and one semester may be current at a time.
-- Enforced at the database level via partial unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_years_single_current
  ON academic_years (is_current) WHERE is_current = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_semesters_single_current
  ON semesters (is_current) WHERE is_current = TRUE;

-- ============================================================
-- 3. Course offerings (a course during a semester for a class)
-- ============================================================
-- A course such as "Database Systems" may be offered in every
-- semester. The `courses` table stays the course template; a
-- `course_offerings` row ties one course to one semester, one
-- program and one level, with its own assigned rep and active flag.
CREATE TABLE IF NOT EXISTS course_offerings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  level TEXT NOT NULL DEFAULT 'Level 100',
  course_rep_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_offering UNIQUE (course_id, semester_id, program_id, level)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_semester ON course_offerings(semester_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_course ON course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_program_level ON course_offerings(program_id, level);
CREATE INDEX IF NOT EXISTS idx_course_offerings_rep ON course_offerings(course_rep_id);

-- ============================================================
-- 5. Scope existing records (nullable, backward compatible)
-- ============================================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS course_offering_id UUID REFERENCES course_offerings(id) ON DELETE SET NULL;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS course_offering_id UUID REFERENCES course_offerings(id) ON DELETE SET NULL;

ALTER TABLE slides
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS course_offering_id UUID REFERENCES course_offerings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_semester ON sessions(semester_id);
CREATE INDEX IF NOT EXISTS idx_sessions_offering ON sessions(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_assignments_semester ON assignments(semester_id);
CREATE INDEX IF NOT EXISTS idx_assignments_offering ON assignments(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_slides_semester ON slides(semester_id);
CREATE INDEX IF NOT EXISTS idx_slides_offering ON slides(course_offering_id);

-- ============================================================
-- 6. updated_at maintenance
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academic_years_updated ON academic_years;
CREATE TRIGGER trg_academic_years_updated
  BEFORE UPDATE ON academic_years
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_semesters_updated ON semesters;
CREATE TRIGGER trg_semesters_updated
  BEFORE UPDATE ON semesters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_course_offerings_updated ON course_offerings;
CREATE TRIGGER trg_course_offerings_updated
  BEFORE UPDATE ON course_offerings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 7. Validation (database level, not just the UI)
-- ============================================================

-- Semester dates must lie inside their academic year.
CREATE OR REPLACE FUNCTION validate_semester_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_year_start DATE;
  v_year_end DATE;
BEGIN
  SELECT start_date, end_date INTO v_year_start, v_year_end
  FROM academic_years WHERE id = NEW.academic_year_id;

  IF v_year_start IS NULL THEN
    RAISE EXCEPTION 'Semester must belong to an existing academic year';
  END IF;

  IF NEW.start_date < v_year_start OR NEW.end_date > v_year_end THEN
    RAISE EXCEPTION 'Semester dates must fall within the academic year (%, %)', v_year_start, v_year_end;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_semesters_validate ON semesters;
CREATE TRIGGER trg_semesters_validate
  BEFORE INSERT OR UPDATE ON semesters
  FOR EACH ROW EXECUTE FUNCTION validate_semester_dates();

-- ============================================================
-- 8. Row Level Security
-- ============================================================
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings ENABLE ROW LEVEL SECURITY;

-- Every authenticated user may READ academic structure (read-only).
DROP POLICY IF EXISTS "view_academic_years" ON academic_years;
CREATE POLICY "view_academic_years" ON academic_years FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "view_semesters" ON semesters FOR SELECT USING (TRUE);
CREATE POLICY "view_semesters" ON semesters FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "view_course_offerings" ON course_offerings FOR SELECT USING (TRUE);
CREATE POLICY "view_course_offerings" ON course_offerings FOR SELECT USING (TRUE);

-- Academic periods are managed ONLY by super admins.
DROP POLICY IF EXISTS "manage_academic_years" ON academic_years;
CREATE POLICY "manage_academic_years" ON academic_years FOR ALL
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "manage_semesters" ON semesters;
CREATE POLICY "manage_semesters" ON semesters FOR ALL
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "manage_course_offerings_super" ON course_offerings;
CREATE POLICY "manage_course_offerings_super" ON course_offerings FOR ALL
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

-- Course representatives (admins) may create/update offerings for
-- their own program and level (needed to run sessions). They may
-- NOT delete offerings; that is reserved for super admins.
DROP POLICY IF EXISTS "admin_insert_course_offerings" ON course_offerings;
CREATE POLICY "admin_insert_course_offerings" ON course_offerings FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    AND program_id::text = (SELECT program FROM profiles WHERE id = auth.uid())
    AND level = (SELECT level FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_course_offerings" ON course_offerings;
CREATE POLICY "admin_update_course_offerings" ON course_offerings FOR UPDATE
  USING (
    get_user_role() = 'admin'
    AND program_id::text = (SELECT program FROM profiles WHERE id = auth.uid())
    AND level = (SELECT level FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    get_user_role() = 'admin'
    AND program_id::text = (SELECT program FROM profiles WHERE id = auth.uid())
    AND level = (SELECT level FROM profiles WHERE id = auth.uid())
  );

-- Hardening: sessions must be attributed to the caller (prevents an
-- admin from creating a session while impersonating another admin).
DROP POLICY IF EXISTS "insert_admin_sessions" ON sessions;
CREATE POLICY "insert_admin_sessions" ON sessions FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'super_admin')
    AND created_by = auth.uid()
  );

-- ============================================================
-- 9. Current-period RPCs
-- ============================================================

-- Set the single current academic year (server-side guard).
CREATE OR REPLACE FUNCTION set_current_academic_year(p_year_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super admin can set the current academic year';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_year_id) THEN
    RAISE EXCEPTION 'Academic year not found';
  END IF;

  UPDATE academic_years SET is_current = FALSE WHERE is_current = TRUE;
  UPDATE academic_years SET is_current = TRUE, is_archived = FALSE WHERE id = p_year_id;
END;
$$;

-- Set the single current semester; its parent year becomes current too.
CREATE OR REPLACE FUNCTION set_current_semester(p_semester_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_id UUID;
BEGIN
  IF get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super admin can set the current semester';
  END IF;

  SELECT academic_year_id INTO v_year_id FROM semesters WHERE id = p_semester_id;
  IF v_year_id IS NULL THEN
    RAISE EXCEPTION 'Semester not found';
  END IF;

  UPDATE semesters SET is_current = FALSE WHERE is_current = TRUE;
  UPDATE semesters SET is_current = TRUE, is_archived = FALSE WHERE id = p_semester_id;

  UPDATE academic_years SET is_current = FALSE WHERE is_current = TRUE;
  UPDATE academic_years SET is_current = TRUE, is_archived = FALSE WHERE id = v_year_id;
END;
$$;

-- Single source of truth for "what period are we in right now".
CREATE OR REPLACE FUNCTION get_current_academic_period()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year academic_years%ROWTYPE;
  v_semester semesters%ROWTYPE;
BEGIN
  SELECT * INTO v_semester FROM semesters WHERE is_current = TRUE LIMIT 1;

  IF v_semester.id IS NOT NULL THEN
    SELECT * INTO v_year FROM academic_years WHERE id = v_semester.academic_year_id;
  ELSE
    SELECT * INTO v_year FROM academic_years WHERE is_current = TRUE LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'year', CASE
      WHEN v_year.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_year.id,
        'name', v_year.name,
        'start_date', v_year.start_date,
        'end_date', v_year.end_date,
        'is_current', v_year.is_current,
        'is_archived', v_year.is_archived
      )
    END,
    'semester', CASE
      WHEN v_semester.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_semester.id,
        'academic_year_id', v_semester.academic_year_id,
        'name', v_semester.name,
        'semester_number', v_semester.semester_number,
        'start_date', v_semester.start_date,
        'end_date', v_semester.end_date,
        'is_current', v_semester.is_current,
        'is_archived', v_semester.is_archived
      )
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION set_current_academic_year FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_current_semester FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_current_academic_period FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_current_academic_year TO authenticated;
GRANT EXECUTE ON FUNCTION set_current_semester TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_academic_period TO authenticated;

-- ============================================================
-- 10. Backfill historical records (idempotent, non-destructive)
-- ============================================================
-- Creates a single legacy academic period that holds all
-- pre-existing courses/sessions/assignments/slides so that
-- nothing is lost and no record lives outside an academic context.
DO $$
DECLARE
  v_legacy_year_id UUID;
  v_legacy_semester_id UUID;
  v_start DATE;
  v_end DATE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM academic_years LIMIT 1) THEN
    SELECT MIN(session_date), MAX(session_date) INTO v_start, v_end FROM sessions;
    v_start := COALESCE(v_start, DATE '2000-01-01');
    v_end := COALESCE(v_end, CURRENT_DATE);

    INSERT INTO academic_years (name, start_date, end_date, is_current, is_archived)
    VALUES ('Legacy (Pre-2026/2027)', v_start, v_end, FALSE, FALSE)
    RETURNING id INTO v_legacy_year_id;

    INSERT INTO semesters (academic_year_id, name, semester_number, start_date, end_date, is_current, is_archived)
    VALUES (v_legacy_year_id, 'Legacy Semester', 1, v_start, v_end, TRUE, FALSE)
    RETURNING id INTO v_legacy_semester_id;
  END IF;
END $$;

DO $$
DECLARE
  v_legacy_semester_id UUID;
BEGIN
  SELECT id INTO v_legacy_semester_id FROM semesters WHERE is_current = TRUE LIMIT 1;
  IF v_legacy_semester_id IS NULL THEN
    SELECT id INTO v_legacy_semester_id FROM semesters ORDER BY start_date LIMIT 1;
  END IF;

  IF v_legacy_semester_id IS NOT NULL THEN
    -- Offerings for every existing course (guarding against NULL program_id).
    INSERT INTO course_offerings (course_id, semester_id, program_id, level, course_rep_id, is_active)
    SELECT c.id, v_legacy_semester_id, c.program_id, c.level, c.course_rep_id, TRUE
    FROM courses c
    WHERE c.program_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Offerings for any distinct (course, program, level) combos referenced by sessions.
    INSERT INTO course_offerings (course_id, semester_id, program_id, level, is_active)
    SELECT DISTINCT s.course_id, v_legacy_semester_id, s.program_id, s.level, TRUE
    FROM sessions s
    WHERE s.program_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Backfill sessions into the legacy period.
    UPDATE sessions s
    SET semester_id = v_legacy_semester_id,
        course_offering_id = (
          SELECT o.id FROM course_offerings o
          WHERE o.course_id = s.course_id
            AND o.program_id = s.program_id
            AND o.level = s.level
            AND o.semester_id = v_legacy_semester_id
          LIMIT 1
        )
    WHERE s.semester_id IS NULL;

    -- Backfill assignments (no level column: pick the offering's default level).
    UPDATE assignments a
    SET semester_id = v_legacy_semester_id,
        course_offering_id = (
          SELECT o.id FROM course_offerings o
          WHERE o.course_id = a.course_id
            AND o.program_id = a.program_id
            AND o.semester_id = v_legacy_semester_id
          ORDER BY o.level
          LIMIT 1
        )
    WHERE a.semester_id IS NULL;

    -- Backfill slides (same strategy as assignments).
    UPDATE slides sl
    SET semester_id = v_legacy_semester_id,
        course_offering_id = (
          SELECT o.id FROM course_offerings o
          WHERE o.course_id = sl.course_id
            AND o.program_id = sl.program_id
            AND o.semester_id = v_legacy_semester_id
          ORDER BY o.level
          LIMIT 1
        )
    WHERE sl.semester_id IS NULL;
  END IF;
END $$;
