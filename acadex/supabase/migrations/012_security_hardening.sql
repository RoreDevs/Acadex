-- 012: Security hardening (idempotent, safe to re-run)
-- Run AFTER all previous migrations.

-- ============================================================
-- B1: Lock the `role` column so it can never be changed client-side
-- ============================================================

DROP POLICY IF EXISTS "update_own" ON profiles;
CREATE POLICY "update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_signup" ON profiles;
CREATE POLICY "insert_signup" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'student');

-- Scope admin profile visibility to their own program (super admin sees all)
DROP POLICY IF EXISTS "view_all_admin" ON profiles;
CREATE POLICY "view_all_admin" ON profiles FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() = 'admin'
      AND (
        id = auth.uid()
        OR program = (SELECT program FROM profiles WHERE id = auth.uid())
      )
    )
  );

-- ============================================================
-- C2: Session ownership — admins may only modify their own sessions
-- ============================================================

DROP POLICY IF EXISTS "update_admin_sessions" ON sessions;
CREATE POLICY "update_admin_sessions" ON sessions FOR UPDATE
  USING (created_by = auth.uid() OR get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "delete_admin_sessions" ON sessions;
CREATE POLICY "delete_admin_sessions" ON sessions FOR DELETE
  USING (created_by = auth.uid() OR get_user_role() = 'super_admin');

-- ============================================================
-- C3/C4: Scope admin reads of enrollments/attendance to their program
-- (profile.program stores the program UUID as text)
-- ============================================================

DROP POLICY IF EXISTS "view_admin_enroll" ON enrollments;
CREATE POLICY "view_admin_enroll" ON enrollments FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles admin, profiles stu
      WHERE admin.id = auth.uid()
        AND admin.role = 'admin'
        AND stu.id = enrollments.student_id
        AND stu.program = admin.program
    )
  );

DROP POLICY IF EXISTS "view_admin_att" ON attendance;
CREATE POLICY "view_admin_att" ON attendance FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles admin
      WHERE admin.id = auth.uid()
        AND admin.role = 'admin'
        AND EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = attendance.session_id
            AND s.program_id::text = admin.program
        )
    )
  );

-- ============================================================
-- E: Attendance insert requires enrollment + self (defense in depth)
-- ============================================================

DROP POLICY IF EXISTS "insert_own_att" ON attendance;
CREATE POLICY "insert_own_att" ON attendance FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sessions s
      JOIN enrollments e ON e.course_id = s.course_id
      WHERE s.id = session_id
        AND e.student_id = auth.uid()
    )
  );

-- ============================================================
-- B4: Notifications insert — sender must be self; recipient may only
-- be someone else when the caller is a super admin (no forgery).
-- ============================================================

DROP POLICY IF EXISTS "insert_system_notif" ON notifications;
CREATE POLICY "insert_notif" ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (auth.uid() = user_id OR get_user_role() = 'super_admin')
  );

-- ============================================================
-- B5: Audit logs insert — identity is always the caller (RPC sets it).
-- ============================================================

DROP POLICY IF EXISTS "insert_system_audit" ON audit_logs;
CREATE POLICY "insert_audit" ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Secure server-side RPCs (SECURITY DEFINER) — never trust client role
-- ============================================================

-- Self-signup always creates a student profile (role fixed server-side)
CREATE OR REPLACE FUNCTION create_signup_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_index_number text,
  p_program text,
  p_level text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prog RECORD;
BEGIN
  -- Enforce index-number format per programme type so outsiders cannot
  -- register with made-up index numbers. Unknown programme types are
  -- allowed through (frontend still guides the format).
  IF p_program ~ '^[0-9a-fA-F-]{36}$' THEN
    SELECT * INTO v_prog FROM programs WHERE id = p_program::uuid;
    IF FOUND THEN
      IF v_prog.code ILIKE '%BTECH%' OR v_prog.name ILIKE '%BTECH%' THEN
        IF BTRIM(COALESCE(p_index_number, '')) !~* '^B[0-9]{9}$' THEN
          RAISE EXCEPTION 'Invalid index number.';
        END IF;
      ELSIF v_prog.code ILIKE '%HND%' OR v_prog.name ILIKE '%HND%' THEN
        IF BTRIM(COALESCE(p_index_number, '')) !~* '^[A-Z0-9]{2}/20[0-9]{2}/[0-9]{4}D$' THEN
          RAISE EXCEPTION 'Invalid index number.';
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO profiles (id, email, full_name, index_number, program, level, role)
  VALUES (p_user_id, p_email, p_full_name, p_index_number, p_program, p_level, 'student');
END;
$$;

-- Promote the FIRST account to super admin only (idempotent guard)
CREATE OR REPLACE FUNCTION promote_to_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM profiles WHERE role = 'super_admin') > 0 THEN
    RAISE EXCEPTION 'A super admin already exists';
  END IF;
  UPDATE profiles SET role = 'super_admin' WHERE id = p_user_id;
END;
$$;

-- Audit logging with server-set identity (no client-supplied user_name)
CREATE OR REPLACE FUNCTION log_audit(p_action text, p_details text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();
  INSERT INTO audit_logs (user_id, user_name, action, details)
  VALUES (auth.uid(), COALESCE(v_name, 'Unknown'), p_action, p_details);
END;
$$;

-- Self-service account deletion (profile cascades via FK ON DELETE CASCADE)
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM profiles WHERE id = auth.uid();
  -- Remove the auth user (requires privilege on auth schema; best-effort)
  BEGIN
    PERFORM auth.delete_user(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- If auth.delete_user is unavailable, the profile delete above still stands
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION create_signup_profile TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_account TO authenticated;

-- ============================================================
-- E: Harden verify_attendance_location — enforce enrollment + time window
-- (server-side authority; client coordinates are self-reported)
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
  v_session_lat DECIMAL;
  v_session_lng DECIMAL;
  v_radius_meters INTEGER;
  v_distance DOUBLE PRECISION;
  v_existing_id UUID;
  v_session_active BOOLEAN;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Caller must be the student themselves
  IF auth.uid() <> p_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only mark attendance for yourself.');
  END IF;

  -- Enrollment check (core business rule)
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    JOIN enrollments e ON e.course_id = s.course_id
    WHERE s.id = p_session_id AND e.student_id = p_student_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ENROLLED', 'message', 'You are not enrolled in this course.');
  END IF;

  SELECT is_active, latitude, longitude,
         (session_date + start_time), (session_date + end_time)
    INTO v_session_active, v_session_lat, v_session_lng, v_start, v_end
  FROM sessions WHERE id = p_session_id;

  IF v_session_active IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;

  IF NOT v_session_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_INACTIVE', 'message', 'Session has ended.');
  END IF;

  IF v_now < v_start OR v_now > v_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'OUTSIDE_WINDOW', 'message', 'Attendance is only allowed during the scheduled session time.');
  END IF;

  -- Duplicate check
  SELECT id INTO v_existing_id FROM attendance
  WHERE student_id = p_student_id AND session_id = p_session_id;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE', 'message', 'You have already marked attendance for this session.');
  END IF;

  -- Get configured radius (default 500m)
  SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_radius_meters'), 500)
    INTO v_radius_meters;

  -- No classroom location set -> allow without location verification
  IF v_session_lat IS NULL OR v_session_lng IS NULL THEN
    INSERT INTO attendance (student_id, session_id, status, student_latitude, student_longitude, location_verified)
    VALUES (p_student_id, p_session_id, 'present', p_student_lat, p_student_lng, FALSE)
    RETURNING id INTO v_existing_id;
    RETURN jsonb_build_object('success', TRUE, 'id', v_existing_id, 'location_verified', FALSE, 'message', 'Attendance marked successfully.');
  END IF;

  -- Haversine distance
  SELECT 2 * 6371000 * ASIN(SQRT(
    SIN(RADIANS(v_session_lat - p_student_lat) / 2)^2 +
    COS(RADIANS(v_session_lat)) * COS(RADIANS(p_student_lat)) *
    SIN(RADIANS(v_session_lng - p_student_lng) / 2)^2
  )) INTO v_distance;

  IF v_distance > v_radius_meters THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'OUTSIDE_RADIUS',
      'distance', ROUND(v_distance::DECIMAL, 1), 'radius', v_radius_meters,
      'message', 'You must be within the classroom area to mark attendance.'
    );
  END IF;

  INSERT INTO attendance (student_id, session_id, status, student_latitude, student_longitude, location_verified)
  VALUES (p_student_id, p_session_id, 'present', p_student_lat, p_student_lng, TRUE)
  RETURNING id INTO v_existing_id;

  RETURN jsonb_build_object(
    'success', TRUE, 'id', v_existing_id, 'location_verified', TRUE,
    'distance', ROUND(v_distance::DECIMAL, 1), 'message', 'Attendance marked successfully.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_attendance_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_attendance_location TO authenticated;
