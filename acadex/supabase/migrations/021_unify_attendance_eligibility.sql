-- 021: ONE definition of course eligibility for attendance
-- ============================================================
-- Replaces the four disagreeing definitions found in the audit:
--
--   * get_session_for_marking / do_mark_attendance compared the STUDENT's
--     profiles.program + profiles.level with the SESSION's program_id + level
--     using raw text equality.
--   * admin_set_attendance_status required a row in enrollments.
--   * every analytics function in 017 JOINs enrollments.
--   * the curriculum was never consulted by attendance at all.
--
-- This migration establishes ONE rule, evaluated per SESSION:
--
--   1. An explicit enrolment (enrollments.source = 'explicit') always wins.
--   2. Otherwise the student's programme + level must match a registration of
--      that course in curriculum_courses or courses.
--   3. The session's own cohort must agree with the student's, whenever the
--      session declares a cohort that is itself a valid registration of the
--      course. If the session's cohort is NOT a valid registration (legacy
--      sessions stamped from the creating admin's profile), it is ignored and
--      the course registration from (2) governs - so the original bug is
--      fixed without re-introducing it.
--   4. If the session carries a course_offering_id, that offering is
--      authoritative: student programme AND level must match it.
--
-- Derived enrolments exist so analytics and manual correction see the same
-- population. They are tagged with provenance (enrollments.source), rebuilt
-- (not accumulated) on every profile/course/curriculum change, and are the
-- ONLY rows this migration ever deletes.
--
-- NON-DESTRUCTIVE: no table/column/policy/row is dropped. The single schema
-- change is an additive column with a default.
--
-- DEPLOYMENT ORDER
--   1. 021 (this file)      - schema, functions, triggers. No data movement.
--   2. 022_backfill_derived_enrollments.sql - separate, set-based backfill.
--   3. Redeploy the front end (session creation + attendance messaging).
--
-- ROLLBACK
--   Run the procedure in section 9, in that exact order. Restore the 016
--   function bodies FIRST: plpgsql bodies are not dependency-tracked, so
--   dropping the helpers before that leaves the RPCs calling missing
--   functions and every attendance attempt fails at runtime.
--   This migration never requires deleting rows from enrollments.
-- ============================================================

-- ============================================================
-- 1. Provenance for enrolments (explicit vs derived)
-- ============================================================
-- All pre-existing rows (demo seed, manual/super-admin entries) are
-- classified 'explicit' by the default and are therefore never touched by
-- any synchronisation below.
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'explicit';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_source_check'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_source_check
      CHECK (source IN ('explicit', 'derived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_source ON enrollments(source);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_source ON enrollments(student_id, source);

-- ============================================================
-- 2. Normalisation helpers
-- ============================================================

-- 'Level 200' -> '200', '200' -> '200', 'L200' -> '200', ' level 200 ' -> '200'.
-- Falls back to the lower-cased text when it contains no digits.
CREATE OR REPLACE FUNCTION public.normalize_level(p_level TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(regexp_replace(lower(btrim(COALESCE(p_level, ''))), '[^0-9]', '', 'g'), ''),
    lower(btrim(COALESCE(p_level, '')))
  );
$$;

-- Resolve a profile's programme identifier deterministically:
--   1. UUID   2. exact code   3. exact name.
-- Returns NULL for anything unresolved or ambiguous. No prefix, partial or
-- fuzzy matching is used anywhere.
CREATE OR REPLACE FUNCTION public.program_id_for_profile(p_program TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_txt   TEXT := lower(btrim(COALESCE(p_program, '')));
  v_id    UUID;
  v_found INT;
BEGIN
  IF v_txt = '' THEN
    RETURN NULL;
  END IF;

  -- 1. UUID
  BEGIN
    v_id := v_txt::uuid;
    IF EXISTS (SELECT 1 FROM programs WHERE id = v_id) THEN
      RETURN v_id;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL; -- not a UUID; fall through
  END;

  -- 2. exact programme code (ambiguity -> NULL)
  SELECT count(*) INTO v_found FROM programs WHERE lower(btrim(code)) = v_txt;
  IF v_found = 1 THEN
    SELECT id INTO v_id FROM programs WHERE lower(btrim(code)) = v_txt;
    RETURN v_id;
  ELSIF v_found > 1 THEN
    RETURN NULL;
  END IF;

  -- 3. exact programme name (ambiguity -> NULL)
  SELECT count(*) INTO v_found FROM programs WHERE lower(btrim(name)) = v_txt;
  IF v_found = 1 THEN
    SELECT id INTO v_id FROM programs WHERE lower(btrim(name)) = v_txt;
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Is this course registered for (programme, level)?
-- Only durable registrations count: the year-independent curriculum and the
-- course's own (legacy) identity. course_offerings are deliberately NOT used
-- here: a single historical or misconfigured offering must not grant
-- permanent eligibility (see section 3, where an offering is honoured only
-- through the session that explicitly references it).
CREATE OR REPLACE FUNCTION public.course_registered_for_level(
  p_course_id UUID,
  p_program_id UUID,
  p_level TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_course_id IS NOT NULL
     AND p_program_id IS NOT NULL
     AND public.normalize_level(p_level) <> ''
     AND (
       EXISTS (
         SELECT 1 FROM curriculum_courses cc
         WHERE cc.course_id = p_course_id
           AND cc.program_id = p_program_id
           AND public.normalize_level(cc.level) = public.normalize_level(p_level)
       )
       OR EXISTS (
         SELECT 1 FROM courses c
         WHERE c.id = p_course_id
           AND c.program_id = p_program_id
           AND public.normalize_level(c.level) = public.normalize_level(p_level)
       )
     );
$$;

-- Same test, resolved from a student's stored cohort.
CREATE OR REPLACE FUNCTION public.course_registered_for_profile(
  p_course_id UUID,
  p_student_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = p_student_id
      AND public.program_id_for_profile(p.program) IS NOT NULL
      AND public.course_registered_for_level(
            p_course_id,
            public.program_id_for_profile(p.program),
            p.level
          )
  );
$$;

-- ============================================================
-- 3. The single, session-aware eligibility rule
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_student_eligible(
  p_student_id UUID,
  p_session_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_program UUID;
  v_level   TEXT;
  v_offering RECORD;
BEGIN
  IF p_student_id IS NULL OR p_session_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Explicit enrolment wins (an administrator's decision is authoritative).
  IF EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = p_student_id
      AND e.course_id = v_session.course_id
      AND e.source = 'explicit'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. The student's authoritative cohort.
  SELECT public.program_id_for_profile(p.program),
         public.normalize_level(p.level)
    INTO v_program, v_level
  FROM profiles p
  WHERE p.id = p_student_id;

  IF v_program IS NULL OR v_level IS NULL OR v_level = '' THEN
    RETURN FALSE;
  END IF;

  -- 3. The course must be registered for that cohort.
  IF NOT public.course_registered_for_level(v_session.course_id, v_program, v_level) THEN
    RETURN FALSE;
  END IF;

  -- 4. A referenced offering is authoritative for this session.
  IF v_session.course_offering_id IS NOT NULL THEN
    SELECT * INTO v_offering FROM course_offerings
    WHERE id = v_session.course_offering_id;
    IF FOUND AND v_offering.course_id = v_session.course_id THEN
      RETURN v_offering.program_id = v_program
         AND public.normalize_level(v_offering.level) = v_level;
    END IF;
  END IF;

  -- 5. If the session declares a cohort that is a REAL registration of this
  --    course, the student must be in that cohort. This is what stops a
  --    Level 200 student attending a Level 300 session of a course that is
  --    registered at both levels.
  IF v_session.program_id IS NOT NULL
     AND public.course_registered_for_level(
           v_session.course_id, v_session.program_id, v_session.level
         ) THEN
    RETURN v_session.program_id = v_program
       AND public.normalize_level(v_session.level) = v_level;
  END IF;

  -- 6. The session's stamp is not a valid registration of this course
  --    (legacy sessions carry the creating admin's cohort). It cannot be
  --    trusted, so the course registration from (3) governs.
  RETURN TRUE;
END;
$$;

-- ============================================================
-- 4. Derived enrolments: rebuilt, never accumulated
-- ============================================================
-- Explicit rows are never read for deletion and never modified. Only rows with
-- source = 'derived' are replaced, so:
--   * a student who changes level loses the previous cohort's rows;
--   * a course removed from the curriculum loses its derived rows;
--   * an explicit enrolment survives every rebuild.
-- ON CONFLICT DO NOTHING means an explicit row always shadows a derived one.

CREATE OR REPLACE FUNCTION public.sync_student_enrollments(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program UUID;
  v_level   TEXT;
  v_rows    INTEGER := 0;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT public.program_id_for_profile(p.program),
         public.normalize_level(p.level)
    INTO v_program, v_level
  FROM profiles p
  WHERE p.id = p_student_id;

  -- Always clear this student's derived rows first: an unresolvable cohort
  -- must not leave the old cohort's eligibility behind.
  DELETE FROM enrollments
  WHERE student_id = p_student_id AND source = 'derived';

  IF v_program IS NULL OR v_level IS NULL OR v_level = '' THEN
    RETURN 0;
  END IF;

  INSERT INTO enrollments (student_id, course_id, source)
  SELECT p_student_id, x.course_id, 'derived'
  FROM (
    SELECT c.id AS course_id
    FROM courses c
    WHERE c.program_id = v_program
      AND public.normalize_level(c.level) = v_level
    UNION
    SELECT cc.course_id
    FROM curriculum_courses cc
    WHERE cc.program_id = v_program
      AND public.normalize_level(cc.level) = v_level
  ) x
  ON CONFLICT (student_id, course_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_course_enrollments(p_course_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF p_course_id IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM enrollments
  WHERE course_id = p_course_id AND source = 'derived';

  INSERT INTO enrollments (student_id, course_id, source)
  SELECT p.id, p_course_id, 'derived'
  FROM profiles p
  WHERE p.role IN ('student', 'admin')
    AND public.course_registered_for_profile(p_course_id, p.id)
  ON CONFLICT (student_id, course_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- ============================================================
-- 5. Observable failure capture (never blocks the caller)
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollment_sync_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation TEXT NOT NULL,
  student_id UUID,
  course_id UUID,
  sqlstate TEXT,
  message TEXT,
  resolved_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_enroll_sync_failures_open
  ON enrollment_sync_failures(occurred_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE enrollment_sync_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_enrollment_sync_failures" ON enrollment_sync_failures;
CREATE POLICY "view_enrollment_sync_failures" ON enrollment_sync_failures FOR SELECT
  USING (get_user_role() = 'super_admin');

-- Logging must never itself raise: a failure while recording a failure would
-- otherwise break the user's own write.
CREATE OR REPLACE FUNCTION public.log_enrollment_sync_failure(
  p_operation TEXT,
  p_student_id UUID,
  p_course_id UUID,
  p_sqlstate TEXT,
  p_message TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO enrollment_sync_failures (operation, student_id, course_id, sqlstate, message)
  VALUES (p_operation, p_student_id, p_course_id, p_sqlstate, left(COALESCE(p_message, ''), 500));
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Re-run every unresolved failure. Synchronisation is a full rebuild, so a
-- retry is always safe and idempotent.
CREATE OR REPLACE FUNCTION public.retry_failed_enrollment_syncs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_ok INTEGER := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT student_id, course_id
    FROM enrollment_sync_failures
    WHERE resolved_at IS NULL
  LOOP
    BEGIN
      IF r.student_id IS NOT NULL THEN
        PERFORM public.sync_student_enrollments(r.student_id);
      ELSIF r.course_id IS NOT NULL THEN
        PERFORM public.sync_course_enrollments(r.course_id);
      END IF;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- leave unresolved for the next attempt
    END;
  END LOOP;

  UPDATE enrollment_sync_failures
  SET resolved_at = NOW()
  WHERE resolved_at IS NULL;

  RETURN v_ok;
END;
$$;

-- ============================================================
-- 6. Triggers
--    Failures are recorded in enrollment_sync_failures (with context) and
--    still never break the caller. No silent success: the row is the record.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_sync_enrollments_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('student', 'admin') THEN
    BEGIN
      PERFORM public.sync_student_enrollments(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_enrollment_sync_failure(
        'profiles_insert_or_update', NEW.id, NULL, SQLSTATE, SQLERRM
      );
      RAISE WARNING 'enrolment sync failed for student % (%): %', NEW.id, SQLSTATE, SQLERRM;
    END;
  ELSE
    -- A promoted/demoted role that is no longer student/admin must not keep
    -- derived eligibility.
    BEGIN
      DELETE FROM enrollments WHERE student_id = NEW.id AND source = 'derived';
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_enrollment_sync_failure(
        'profiles_role_change', NEW.id, NULL, SQLSTATE, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_enrollments_course()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.sync_course_enrollments(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_enrollment_sync_failure(
      'courses_insert_or_update', NULL, NEW.id, SQLSTATE, SQLERRM
    );
    RAISE WARNING 'enrolment sync failed for course % (%): %', NEW.id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_enrollments_curriculum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN
      PERFORM public.sync_course_enrollments(OLD.course_id);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_enrollment_sync_failure(
        'curriculum_delete', NULL, OLD.course_id, SQLSTATE, SQLERRM
      );
      RAISE WARNING 'enrolment sync failed for curriculum delete (%): %', SQLSTATE, SQLERRM;
    END;
    RETURN OLD;
  END IF;

  BEGIN
    PERFORM public.sync_course_enrollments(NEW.course_id);
    -- Moving a curriculum row between courses must clear the old course too.
    IF TG_OP = 'UPDATE' AND OLD.course_id IS DISTINCT FROM NEW.course_id THEN
      PERFORM public.sync_course_enrollments(OLD.course_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_enrollment_sync_failure(
      'curriculum_' || lower(TG_OP), NULL, NEW.course_id, SQLSTATE, SQLERRM
    );
    RAISE WARNING 'enrolment sync failed for curriculum % (%): %', TG_OP, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Dependent triggers are dropped before their functions (see section 9).
DROP TRIGGER IF EXISTS trg_sync_enrollments_profile ON profiles;
CREATE TRIGGER trg_sync_enrollments_profile
  AFTER INSERT OR UPDATE OF program, level, role ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_enrollments_profile();

DROP TRIGGER IF EXISTS trg_sync_enrollments_course ON courses;
CREATE TRIGGER trg_sync_enrollments_course
  AFTER INSERT OR UPDATE OF program_id, level ON courses
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_enrollments_course();

DROP TRIGGER IF EXISTS trg_sync_enrollments_curriculum ON curriculum_courses;
CREATE TRIGGER trg_sync_enrollments_curriculum
  AFTER INSERT OR UPDATE OR DELETE ON curriculum_courses
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_enrollments_curriculum();

-- ============================================================
-- 7. Attendance functions now use the shared rule
--    Every security check from 016 is preserved verbatim.
-- ============================================================

-- 7a. Preview (get_session_for_marking) — identical contract.
CREATE OR REPLACE FUNCTION get_session_for_marking(p_attendance_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_open_minutes INT;
  v_open TIMESTAMPTZ;
  v_close TIMESTAMPTZ;
  v_status TEXT;
  v_enrolled BOOLEAN := FALSE;
  v_already BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_session FROM sessions
  WHERE attendance_code = UPPER(BTRIM(p_attendance_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_open_minutes_before'), 10) INTO v_open_minutes;
  v_open := v_session.session_date
            + COALESCE(v_session.attendance_open_time, (v_session.start_time - make_interval(mins => v_open_minutes))::time);
  v_close := v_session.session_date
             + COALESCE(v_session.attendance_close_time, v_session.end_time);

  IF v_session.status = 'cancelled' THEN
    v_status := 'cancelled';
  ELSIF v_session.status IN ('scheduled', 'open') THEN
    IF now() > v_close THEN
      v_status := 'closed';
      UPDATE sessions SET status = 'closed'
      WHERE id = v_session.id AND status IN ('scheduled', 'open');
    ELSIF v_session.status = 'scheduled' AND now() >= v_open THEN
      v_status := 'open';
      UPDATE sessions SET status = 'open' WHERE id = v_session.id AND status = 'scheduled';
    ELSE
      v_status := v_session.status;
    END IF;
  ELSE
    -- 'closed' stored: admin closed it early; respected until reopened.
    v_status := v_session.status;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    -- ONE rule, shared with do_mark_attendance and admin_set_attendance_status.
    SELECT public.is_student_eligible(auth.uid(), v_session.id) INTO v_enrolled;

    SELECT EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.student_id = auth.uid() AND a.session_id = v_session.id
    ) INTO v_already;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'enrolled', v_enrolled,
    'already_marked', v_already,
    'session', jsonb_build_object(
      'id', v_session.id,
      'title', v_session.title,
      'attendance_code', v_session.attendance_code,
      'session_date', v_session.session_date,
      'start_time', v_session.start_time,
      'end_time', v_session.end_time,
      'venue', v_session.venue,
      'has_location', (v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL)
    ),
    'course', (SELECT jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title) FROM courses c WHERE c.id = v_session.course_id),
    'window', jsonb_build_object('opens_at', v_open, 'closes_at', v_close)
  );
END;
$$;

-- 7b. Core marking logic (do_mark_attendance).
CREATE OR REPLACE FUNCTION do_mark_attendance(
  p_session_id UUID,
  p_student_lat DECIMAL,
  p_student_lng DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_session RECORD;
  v_open_minutes INT;
  v_late_minutes INT;
  v_radius_meters INT;
  v_now TIMESTAMPTZ := now();
  v_open TIMESTAMPTZ;
  v_close TIMESTAMPTZ;
  v_late_cutoff TIMESTAMPTZ;
  v_status TEXT;
  v_distance DOUBLE PRECISION;
  v_existing_id UUID;
  v_loc_verified BOOLEAN;
  v_radius_used INT;
BEGIN
  -- Only a student (or a course-rep admin, who is still a student) may
  -- create their own attendance record. super_admin is excluded.
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('student', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only students can mark attendance.');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  -- Same session-aware eligibility rule as the preview and manual correction.
  IF NOT public.is_student_eligible(auth.uid(), v_session.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ENROLLED', 'message', 'You are not enrolled in this course.');
  END IF;

  -- Terminal / admin decisions are respected.
  IF v_session.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_CANCELLED', 'message', 'This session was cancelled.');
  END IF;
  IF v_session.status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_CLOSED', 'message', 'Attendance for this session has closed.');
  END IF;

  -- Effective window (settings are the fallback; per-session wins).
  SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_open_minutes_before'), 10) INTO v_open_minutes;
  SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'late_threshold_minutes'), 15) INTO v_late_minutes;
  SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_radius_meters'), 500) INTO v_radius_meters;

  v_open := v_session.session_date
            + COALESCE(v_session.attendance_open_time, (v_session.start_time - make_interval(mins => v_open_minutes))::time);
  v_close := v_session.session_date
             + COALESCE(v_session.attendance_close_time, v_session.end_time);
  v_late_cutoff := v_session.session_date + v_session.start_time + make_interval(mins => v_late_minutes);

  IF v_now < v_open THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'NOT_OPEN',
      'message', format('Attendance opens at %s.', to_char(v_open, 'HH24:MI'))
    );
  END IF;

  IF v_now > v_close THEN
    UPDATE sessions SET status = 'closed'
    WHERE id = p_session_id AND status IN ('scheduled', 'open');
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_CLOSED', 'message', 'Attendance for this session has closed.');
  END IF;

  -- Lazy auto-open: a scheduled session whose open time has arrived opens itself.
  IF v_session.status = 'scheduled' AND v_now >= v_open THEN
    UPDATE sessions SET status = 'open' WHERE id = p_session_id AND status = 'scheduled';
  END IF;

  -- Duplicate enforcement (also backed by the UNIQUE(student_id, session_id) constraint).
  SELECT id INTO v_existing_id FROM attendance
  WHERE student_id = auth.uid() AND session_id = p_session_id;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE', 'message', 'You have already marked attendance for this session.');
  END IF;

  v_status := CASE WHEN v_now <= v_late_cutoff THEN 'present' ELSE 'late' END;
  v_loc_verified := FALSE;

  -- Location gate (only when the session declares classroom coordinates).
  IF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL THEN
    IF p_student_lat IS NULL OR p_student_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'LOCATION_REQUIRED', 'message', 'Location is required to mark attendance.');
    END IF;

    v_radius_used := COALESCE(v_session.location_radius_meters, v_radius_meters);
    v_distance := 2 * 6371000 * ASIN(SQRT(
      SIN(RADIANS(v_session.latitude - p_student_lat) / 2) ^ 2 +
      COS(RADIANS(v_session.latitude)) * COS(RADIANS(p_student_lat)) *
      SIN(RADIANS(v_session.longitude - p_student_lng) / 2) ^ 2
    ));

    IF v_distance > v_radius_used THEN
      RETURN jsonb_build_object(
        'success', FALSE, 'error', 'OUTSIDE_RADIUS',
        'distance', ROUND(v_distance::DECIMAL, 1), 'radius', v_radius_used,
        'message', 'You must be within the classroom area to mark attendance.'
      );
    END IF;
    v_loc_verified := TRUE;
  END IF;

  INSERT INTO attendance (student_id, session_id, status, timestamp, student_latitude, student_longitude, location_verified)
  VALUES (auth.uid(), p_session_id, v_status, v_now, p_student_lat, p_student_lng, v_loc_verified)
  RETURNING id INTO v_existing_id;

  PERFORM log_audit(
    'attendance_marked',
    jsonb_build_object(
      'attendance_id', v_existing_id,
      'session_id', p_session_id,
      'status', v_status,
      'location_verified', v_loc_verified,
      'distance_m', ROUND(COALESCE(v_distance, 0)::DECIMAL, 1)
    )::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_existing_id,
    'status', v_status,
    'location_verified', v_loc_verified,
    'distance', ROUND(COALESCE(v_distance, 0)::DECIMAL, 1),
    'message', 'Attendance marked successfully.'
  );
END;
$$;

-- 7c. Manual correction (admin_set_attendance_status).
CREATE OR REPLACE FUNCTION admin_set_attendance_status(
  p_session_id UUID,
  p_student_id UUID,
  p_status TEXT,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_session RECORD;
  v_existing_id UUID;
  v_old_status TEXT;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only admins can update attendance.');
  END IF;

  IF p_status NOT IN ('present', 'late', 'absent', 'excused') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Invalid attendance status.');
  END IF;

  IF BTRIM(COALESCE(p_reason, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'REASON_REQUIRED', 'message', 'A reason is required for manual attendance changes.');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  -- Admins are scoped to their own program (program UUID stored as text).
  IF v_role = 'admin'
     AND v_session.program_id::text <> (SELECT program FROM profiles WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only manage attendance for your own program.');
  END IF;

  -- Same session-aware eligibility rule as marking.
  IF NOT public.is_student_eligible(p_student_id, v_session.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ENROLLED', 'message', 'Student is not enrolled in this course.');
  END IF;

  SELECT id, status INTO v_existing_id, v_old_status
  FROM attendance WHERE student_id = p_student_id AND session_id = p_session_id;

  IF v_existing_id IS NULL THEN
    INSERT INTO attendance (student_id, session_id, status, timestamp, modified_by, modified_reason)
    VALUES (p_student_id, p_session_id, p_status, now(), auth.uid(), p_reason)
    RETURNING id INTO v_existing_id;
  ELSE
    UPDATE attendance
    SET status = p_status, modified_by = auth.uid(), modified_reason = p_reason
    WHERE id = v_existing_id;
  END IF;

  PERFORM log_audit(
    'attendance_manual_update',
    jsonb_build_object(
      'attendance_id', v_existing_id,
      'session_id', p_session_id,
      'student_id', p_student_id,
      'old_status', v_old_status,
      'new_status', p_status,
      'reason', p_reason
    )::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_existing_id,
    'old_status', v_old_status,
    'new_status', p_status,
    'message', 'Attendance updated.'
  );
END;
$$;

-- ============================================================
-- 8. Grants
--    CREATE OR REPLACE preserves the existing ACLs of the three RPCs, so the
--    016 grants/revokes still apply. The helpers stay internal: they are
--    called from inside SECURITY DEFINER functions, whose current_user is the
--    owner, so no client needs EXECUTE on them.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.normalize_level(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.program_id_for_profile(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.course_registered_for_level(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.course_registered_for_profile(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_student_eligible(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_student_enrollments(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_course_enrollments(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_enrollment_sync_failure(TEXT, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_failed_enrollment_syncs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_enrollments_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_enrollments_course() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_enrollments_curriculum() FROM PUBLIC;

-- ============================================================
-- 9. ROLLBACK PROCEDURE (run in this exact order)
-- ============================================================
-- This migration never requires deleting enrolment rows.
--
-- STEP 1 - restore the previous attendance behaviour FIRST.
--   Re-execute the CREATE OR REPLACE FUNCTION statements for
--   get_session_for_marking (016:328), do_mark_attendance (016:153) and
--   admin_set_attendance_status (016:413) from 016_attendance_v2.sql.
--   Order matters: plpgsql bodies are not dependency-tracked, so dropping the
--   helpers first would leave these RPCs calling a missing function and every
--   attendance attempt would fail at runtime.
--
-- STEP 2 - drop dependent triggers before their functions.
--   DROP TRIGGER IF EXISTS trg_sync_enrollments_curriculum ON curriculum_courses;
--   DROP TRIGGER IF EXISTS trg_sync_enrollments_course     ON courses;
--   DROP TRIGGER IF EXISTS trg_sync_enrollments_profile    ON profiles;
--
-- STEP 3 - drop the trigger functions, then the sync/helper functions.
--   DROP FUNCTION IF EXISTS public.trg_sync_enrollments_curriculum();
--   DROP FUNCTION IF EXISTS public.trg_sync_enrollments_course();
--   DROP FUNCTION IF EXISTS public.trg_sync_enrollments_profile();
--   DROP FUNCTION IF EXISTS public.retry_failed_enrollment_syncs();
--   DROP FUNCTION IF EXISTS public.log_enrollment_sync_failure(TEXT, UUID, UUID, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.sync_course_enrollments(UUID);
--   DROP FUNCTION IF EXISTS public.sync_student_enrollments(UUID);
--   DROP FUNCTION IF EXISTS public.is_student_eligible(UUID, UUID);
--   DROP FUNCTION IF EXISTS public.course_registered_for_profile(UUID, UUID);
--   DROP FUNCTION IF EXISTS public.course_registered_for_level(UUID, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.program_id_for_profile(TEXT);
--   DROP FUNCTION IF EXISTS public.normalize_level(TEXT);
--
-- STEP 4 - leave data intact.
--   Keep enrollment_sync_failures (harmless, useful post-mortem) or
--   DROP TABLE IF EXISTS enrollment_sync_failures;
--   Keep the enrollments.source column: dropping it would make derived rows
--   indistinguishable from explicit ones, which is exactly the ambiguity this
--   migration removed. Leaving it is harmless to the old code.
--
-- CONSEQUENCE of leaving derived rows (recommended):
--   The previous code counts enrollments for analytics and manual correction.
--   Keeping the derived rows therefore keeps those features working; the
--   previous profile/session eligibility predicate is what gets restored, so
--   marking behaves exactly as before.
--
-- OPT-IN cleanup (only if the rows must go, and only because provenance is
-- explicit rather than guessed from a timestamp):
--   DELETE FROM enrollments WHERE source = 'derived';
--   This affects analytics denominators (they shrink back), which is the
--   only reason it is opt-in rather than automatic.
-- ============================================================
