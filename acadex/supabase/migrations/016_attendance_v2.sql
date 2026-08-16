-- 016: Attendance V2 — session lifecycle + hardened attendance
-- ============================================================
-- Goals:
--  * Replace the boolean is_active model with a lifecycle status
--    ('scheduled' | 'open' | 'closed' | 'cancelled'). is_active is kept
--    as a derived column (is_active = status IN ('scheduled','open')) and
--    synced by trigger, so all existing reads keep working.
--  * Add configurable attendance windows (open before start, close at
--    end), late thresholds, per-session radius overrides and venue.
--  * Add an 'excused' attendance status plus a full audit trail for
--    manual (admin) changes: modified_by, modified_reason, updated_at.
--  * Server-authoritative RPCs for every write path. Client-side direct
--    INSERTs are removed (insert_own_att policy is dropped).
--  * Marking is keyed by the shared attendance CODE, never a session id,
--    so a student cannot forge or substitute a session reference.
--
-- Backward safe + idempotent (safe to re-run after an earlier partial run).
-- Historical attendance records are NOT rewritten.
--
-- NOTE: The migration 011 comment says "200 meters" but the seed value and
-- the app default are both 500m. We keep 500 (do not silently change
-- production) — the discrepancy is documented here.
-- ============================================================

-- ============================================================
-- 1. sessions: lifecycle + window columns
-- ============================================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS attendance_open_time TIME,
  ADD COLUMN IF NOT EXISTS attendance_close_time TIME,
  ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS location_radius_meters INTEGER,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'open', 'closed', 'cancelled'));

-- ============================================================
-- 2. attendance: excused status + manual-change audit trail
-- ============================================================
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modified_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'late', 'absent', 'excused'));

-- ============================================================
-- 3. settings seeds (only if absent)
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('attendance_open_minutes_before', '10'),
  ('late_threshold_minutes', '15')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 4. triggers
-- ============================================================

-- Self-contained helper (defined in 014 too; CREATE OR REPLACE is
-- idempotent) so this migration works regardless of which earlier
-- migrations have already been applied.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- is_active is derived from status. Legacy client code that still flips
-- is_active directly is mapped back onto the lifecycle status.
CREATE OR REPLACE FUNCTION sync_session_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'open' ELSE 'closed' END;
  END IF;
  NEW.is_active := NEW.status IN ('scheduled', 'open');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_status_sync ON sessions;
CREATE TRIGGER trg_sessions_status_sync
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION sync_session_status();

DROP TRIGGER IF EXISTS trg_sessions_updated ON sessions;
CREATE TRIGGER trg_sessions_updated
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_updated ON attendance;
CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_status ON attendance(student_id, status);

-- ============================================================
-- 6. backfill existing sessions (derived, non-destructive)
-- ============================================================
DO $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Derive a status for every legacy (defaulted) session:
  --   * end time passed            -> closed
  --   * class already started      -> open
  --   * still marked active        -> scheduled
  --   * otherwise (inactive)       -> cancelled (ended manually)
  UPDATE sessions
  SET status = CASE
    WHEN (session_date + end_time) < v_now THEN 'closed'
    WHEN (session_date + start_time) <= v_now THEN 'open'
    WHEN is_active THEN 'scheduled'
    ELSE 'cancelled'
  END
  WHERE status = 'scheduled';
END $$;

-- ============================================================
-- 7. RLS: attendance writes go through RPCs only
-- ============================================================
-- Drop the direct-insert policy. Students/admin never INSERT/UPDATE the
-- attendance table directly; every write happens inside a SECURITY
-- DEFINER RPC which re-validates identity, enrollment, window, duplicate
-- and location server-side.
DROP POLICY IF EXISTS "insert_own_att" ON attendance;

-- ============================================================
-- 8. Core marking logic (internal only — NOT granted to clients)
-- ============================================================
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
  -- Only a student may create their own attendance record.
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role <> 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only students can mark attendance.');
  END IF;

  -- Enrollment is checked server-side (not trusted from the client).
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    JOIN enrollments e ON e.course_id = s.course_id
    WHERE s.id = p_session_id AND e.student_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ENROLLED', 'message', 'You are not enrolled in this course.');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
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

-- ============================================================
-- 9. mark_attendance — code-keyed entry point (anti-IDOR)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_attendance(
  p_attendance_code TEXT,
  p_student_lat DECIMAL,
  p_student_lng DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id FROM sessions
  WHERE attendance_code = UPPER(BTRIM(p_attendance_code));

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found. Please check your code.');
  END IF;

  RETURN public.do_mark_attendance(v_session_id, p_student_lat, p_student_lng);
END;
$$;

-- ============================================================
-- 10. get_session_for_marking — safe preview before marking
-- ============================================================
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
    SELECT EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.st-udent_id = auth.uid() AND e.course_id = v_session.course_id
    ) INTO v_enrolled;

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

-- ============================================================
-- 11. admin_set_attendance_status — manual present/late/absent/excused
--     with a mandatory reason + audit trail.
-- ============================================================
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

  IF NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = p_student_id AND e.course_id = v_session.course_id
  ) THEN
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
-- 12. admin_set_session_status — open/close/cancel lifecycle
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_session_status(
  p_session_id UUID,
  p_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_session RECORD;
  v_close TIMESTAMPTZ;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only admins can manage sessions.');
  END IF;

  IF p_status NOT IN ('open', 'closed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Invalid session status.');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  IF v_role = 'admin'
     AND v_session.program_id::text <> (SELECT program FROM profiles WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only manage sessions for your own program.');
  END IF;

  -- Cancelled is terminal.
  IF v_session.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANCELLED_TERMINAL', 'message', 'A cancelled session cannot be reopened.');
  END IF;

  -- Reopening a session whose close time already passed makes no sense.
  IF p_status = 'open' THEN
    v_close := v_session.session_date
              + COALESCE(v_session.attendance_close_time, v_session.end_time);
    IF now() > v_close THEN
      RETURN jsonb_build_object('success', false, 'error', 'PAST_CLOSE', 'message', 'The session time has already passed. Close or cancel it instead.');
    END IF;
  END IF;

  UPDATE sessions SET status = p_status WHERE id = p_session_id;

  PERFORM log_audit(
    'session_status_update',
    jsonb_build_object('session_id', p_session_id, 'old_status', v_session.status, 'new_status', p_status)::text
  );

  RETURN jsonb_build_object('success', true, 'status', p_status, 'message', 'Session updated.');
END;
$$;

-- ============================================================
-- 13. admin_regenerate_session_code
-- ============================================================
CREATE OR REPLACE FUNCTION admin_regenerate_session_code(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_session RECORD;
  v_code TEXT;
  v_prefix TEXT;
  v_tries INT := 0;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only admins can regenerate session codes.');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  IF v_role = 'admin'
     AND v_session.program_id::text <> (SELECT program FROM profiles WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only manage sessions for your own program.');
  END IF;

  v_prefix := split_part(v_session.attendance_code, '-', 1);
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'ACD';
  END IF;

  LOOP
    v_tries := v_tries + 1;
    v_code := UPPER(v_prefix || '-' || left(replace(gen_random_uuid()::text, '-', ''), 5));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM sessions WHERE attendance_code = v_code) OR v_tries >= 20;
  END LOOP;

  IF EXISTS (SELECT 1 FROM sessions WHERE attendance_code = v_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_GEN_FAILED', 'message', 'Could not generate a unique code. Please try again.');
  END IF;

  UPDATE sessions
  SET attendance_code = v_code, qr_code = '/attendance/' || v_code
  WHERE id = p_session_id;

  PERFORM log_audit(
    'session_code_regenerated',
    jsonb_build_object('session_id', p_session_id)::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'attendance_code', v_code,
    'qr_code', '/attendance/' || v_code,
    'message', 'Session code regenerated.'
  );
END;
$$;

-- ============================================================
-- 14. Legacy verify_attendance_location -> delegates to the same core
--     logic so there is a single code path. Old error codes are mapped
--     back to their legacy names for compatibility.
-- ============================================================
CREATE OR REPLACE FUNCTION verify_attendance_location(
  p_student_id UUID,
  p_session_id UUID,
  p_student_lat DECIMAL,
  p_student_lng DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_err TEXT;
BEGIN
  IF auth.uid() <> p_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only mark attendance for yourself.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  v_result := public.do_mark_attendance(p_session_id, p_student_lat, p_student_lng);
  v_err := v_result->>'error';

  IF v_err = 'SESSION_CANCELLED' OR v_err = 'SESSION_CLOSED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_INACTIVE', 'message', 'Session has ended.');
  END IF;
  IF v_err = 'NOT_OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'OUTSIDE_WINDOW', 'message', 'Attendance is only allowed during the scheduled session time.');
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 15. grants
-- ============================================================
REVOKE EXECUTE ON FUNCTION do_mark_attendance FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION verify_attendance_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_attendance_location TO authenticated;

GRANT EXECUTE ON FUNCTION mark_attendance TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_for_marking TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_attendance_status TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_session_status TO authenticated;
GRANT EXECUTE ON FUNCTION admin_regenerate_session_code TO authenticated;
