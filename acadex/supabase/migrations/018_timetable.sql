-- 018: Timetable, Recurring Schedules, and Schedule Exceptions
-- ============================================================
-- Core concepts:
--   recurring_schedules  = the "normal" weekly pattern
--   schedule_exceptions  = per-date overrides (reschedule / cancel /
--                          venue-change / time-change / special)
--   The timetable is NEVER overwritten by one-time changes.
--   Attendance ties to the RESOLVED occurrence (date+time+venue).
--
-- DEPENDS ON: 014 (course_offerings, semesters, academic_years)
--             016 (sessions.status)
-- Idempotent: safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Recurring schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_schedules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time        TIME    NOT NULL,
  end_time          TIME    NOT NULL,
  venue             TEXT,
  effective_start   DATE    NOT NULL,
  effective_end     DATE    NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  program_id        UUID    NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  level             TEXT    NOT NULL,
  created_by        UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_recurring_dates CHECK (effective_end >= effective_start),
  CONSTRAINT chk_recurring_time  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_offering
  ON recurring_schedules(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_program_level
  ON recurring_schedules(program_id, level);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_dates
  ON recurring_schedules(effective_start, effective_end);

-- ============================================================
-- 2. Schedule exceptions
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_schedule_id UUID NOT NULL REFERENCES recurring_schedules(id) ON DELETE CASCADE,
  occurrence_date   DATE    NOT NULL,
  exception_type    TEXT    NOT NULL CHECK (exception_type IN (
    'RESCHEDULED','CANCELLED','VENUE_CHANGED','TIME_CHANGED','SPECIAL_SESSION'
  )),
  new_date          DATE,
  new_start_time    TIME,
  new_end_time      TIME,
  new_venue         TEXT,
  reason            TEXT,
  changed_by        UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_exception_reschedule CHECK (
    exception_type <> 'RESCHEDULED'
    OR (new_date IS NOT NULL AND new_start_time IS NOT NULL AND new_end_time IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_recurring
  ON schedule_exceptions(recurring_schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_date
  ON schedule_exceptions(occurrence_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_exceptions_per_date
  ON schedule_exceptions(recurring_schedule_id, occurrence_date);

-- ============================================================
-- 3. Schedule change audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name      TEXT,
  action          TEXT    NOT NULL,
  schedule_id     UUID,
  course_id       UUID,
  original_values JSONB,
  new_values      JSONB,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_log_actor
  ON schedule_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_schedule_audit_log_schedule
  ON schedule_audit_log(schedule_id);

-- ============================================================
-- 4. Trigger: set_updated_at
-- ============================================================
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
CREATE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger on recurring_schedules (IF NOT EXISTS not available for triggers)
DROP TRIGGER IF EXISTS trg_recurring_schedules_updated_at ON recurring_schedules;
CREATE TRIGGER trg_recurring_schedules_updated_at
  BEFORE UPDATE ON recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_exceptions_updated_at ON schedule_exceptions;
CREATE TRIGGER trg_schedule_exceptions_updated_at
  BEFORE UPDATE ON schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_exceptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_audit_log     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own program schedules" ON recurring_schedules;
CREATE POLICY "Students read own program schedules" ON recurring_schedules
  FOR SELECT USING (
    get_user_role() IN ('student','admin','super_admin')
  );

DROP POLICY IF EXISTS "Admins manage own program schedules" ON recurring_schedules;
CREATE POLICY "Admins manage own program schedules" ON recurring_schedules
  FOR ALL USING (
    get_user_role() IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS "Students read own program exceptions" ON schedule_exceptions;
CREATE POLICY "Students read own program exceptions" ON schedule_exceptions
  FOR SELECT USING (
    get_user_role() IN ('student','admin','super_admin')
  );

DROP POLICY IF EXISTS "Admins manage own program exceptions" ON schedule_exceptions;
CREATE POLICY "Admins manage own program exceptions" ON schedule_exceptions
  FOR ALL USING (
    get_user_role() IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS "Admins read audit log" ON schedule_audit_log;
CREATE POLICY "Admins read audit log" ON schedule_audit_log
  FOR SELECT USING (
    get_user_role() IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS "Admins insert audit log" ON schedule_audit_log;
CREATE POLICY "Admins insert audit log" ON schedule_audit_log
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin','super_admin')
  );

-- ============================================================
-- 6. Helper: expand recurring occurrences in a date range
-- ============================================================
DROP FUNCTION IF EXISTS _expand_occurrences(UUID, DATE, DATE) CASCADE;
CREATE FUNCTION _expand_occurrences(
  p_schedule_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE (
  occurrence_date DATE,
  start_time      TIME,
  end_time        TIME,
  venue           TEXT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT * INTO v_rec FROM recurring_schedules WHERE id = p_schedule_id;
  IF NOT FOUND OR NOT v_rec.is_active THEN RETURN; END IF;

  RETURN QUERY
  WITH series AS (
    SELECT (v_rec.effective_start + d * INTERVAL '1 day')::date AS d
    FROM generate_series(0, v_rec.effective_end - v_rec.effective_start) AS d
  ),
  matched AS (
    SELECT s.d AS occurrence_date
    FROM series s
    WHERE EXTRACT(ISODOW FROM s.d)::int = v_rec.day_of_week
      AND s.d >= p_start
      AND s.d <= p_end
  )
  SELECT m.occurrence_date, v_rec.start_time, v_rec.end_time, v_rec.venue
  FROM matched m;
END;
$$;

-- ============================================================
-- 7. RPC: get timetable for a date range (student-scoped)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_timetable_range(DATE, DATE) CASCADE;
CREATE FUNCTION public.get_timetable_range(
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_program TEXT;
  v_level TEXT;
  v_result JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role IS NULL OR v_role <> 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();

  WITH enrolled_offerings AS (
    SELECT co.id AS offering_id, co.course_id, co.program_id, co.level,
           c.code AS course_code, c.title AS course_title
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN course_offerings co ON co.course_id = e.course_id
      AND co.program_id::text = v_program
      AND co.level = v_level
      AND co.is_active = TRUE
    WHERE e.student_id = auth.uid()
  ),
  expanded AS (
    SELECT
      rs.id AS schedule_id,
      eo.course_id, eo.course_code, eo.course_title,
      occ.occurrence_date,
      occ.start_time,
      occ.end_time,
      occ.venue,
      rs.day_of_week
    FROM recurring_schedules rs
    JOIN enrolled_offerings eo ON eo.offering_id = rs.course_offering_id
    CROSS JOIN LATERAL _expand_occurrences(rs.id, p_start_date, p_end_date) occ
    WHERE rs.is_active = TRUE
      AND eo.program_id::text = v_program
      AND eo.level = v_level
  ),
  resolved AS (
    SELECT
      ex.schedule_id,
      ex.course_id, ex.course_code, ex.course_title,
      ex.occurrence_date,
      ex.start_time,
      ex.end_time,
      ex.venue,
      ex.day_of_week,
      COALESCE(se.exception_type, 'REGULAR') AS exception_type,
      CASE WHEN se.exception_type = 'CANCELLED' THEN TRUE ELSE FALSE END AS is_cancelled,
      se.new_date,
      se.new_start_time,
      se.new_end_time,
      se.new_venue,
      se.reason,
      se.changed_by
    FROM expanded ex
    LEFT JOIN schedule_exceptions se
      ON se.recurring_schedule_id = ex.schedule_id
      AND se.occurrence_date = ex.occurrence_date
  )
  SELECT jsonb_agg(jsonb_build_object(
    'schedule_id', r.schedule_id,
    'course_id', r.course_id,
    'course_code', r.course_code,
    'course_title', r.course_title,
    'day_of_week', r.day_of_week,
    'date', CASE
      WHEN r.exception_type = 'RESCHEDULED' THEN r.new_date
      ELSE r.occurrence_date
    END,
    'start_time', CASE
      WHEN r.exception_type IN ('RESCHEDULED','TIME_CHANGED') THEN r.new_start_time
      ELSE r.start_time
    END,
    'end_time', CASE
      WHEN r.exception_type IN ('RESCHEDULED','TIME_CHANGED') THEN r.new_end_time
      ELSE r.end_time
    END,
    'venue', CASE
      WHEN r.exception_type IN ('RESCHEDULED','VENUE_CHANGED') THEN r.new_venue
      ELSE r.venue
    END,
    'exception_type', r.exception_type,
    'is_cancelled', r.is_cancelled,
    'original_date', r.occurrence_date,
    'original_start_time', r.start_time,
    'original_end_time', r.end_time,
    'original_venue', r.venue,
    'reason', r.reason,
    'status', CASE
      WHEN r.is_cancelled THEN 'cancelled'
      WHEN r.exception_type = 'RESCHEDULED' THEN 'rescheduled'
      ELSE 'scheduled'
    END
  ) ORDER BY
    CASE WHEN r.exception_type = 'RESCHEDULED' THEN r.new_date ELSE r.occurrence_date END,
    r.start_time
  )
  INTO v_result
  FROM resolved r
  WHERE NOT r.is_cancelled;

  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- 8. RPC: get next class (for student dashboard)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_next_class() CASCADE;
CREATE FUNCTION public.get_next_class()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_program TEXT;
  v_level TEXT;
  v_today DATE;
  v_result JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role IS NULL OR v_role <> 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();
  v_today := CURRENT_DATE;

  WITH enrolled_offerings AS (
    SELECT co.id AS offering_id, co.course_id, co.program_id, co.level,
           c.code AS course_code, c.title AS course_title
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN course_offerings co ON co.course_id = e.course_id
      AND co.program_id::text = v_program
      AND co.level = v_level
      AND co.is_active = TRUE
    WHERE e.student_id = auth.uid()
  ),
  expanded AS (
    SELECT
      rs.id AS schedule_id,
      eo.course_id, eo.course_code, eo.course_title,
      occ.occurrence_date,
      occ.start_time,
      occ.end_time,
      occ.venue
    FROM recurring_schedules rs
    JOIN enrolled_offerings eo ON eo.offering_id = rs.course_offering_id
    CROSS JOIN LATERAL _expand_occurrences(rs.id, v_today, v_today + INTERVAL '7 days') occ
    WHERE rs.is_active = TRUE
      AND eo.program_id::text = v_program
      AND eo.level = v_level
  ),
  resolved AS (
    SELECT
      ex.*,
      COALESCE(se.exception_type, 'REGULAR') AS exception_type,
      se.new_date, se.new_start_time, se.new_end_time, se.new_venue,
      se.reason
    FROM expanded ex
    LEFT JOIN schedule_exceptions se
      ON se.recurring_schedule_id = ex.schedule_id
      AND se.occurrence_date = ex.occurrence_date
  ),
  final_occurrences AS (
    SELECT
      r.*,
      CASE
        WHEN r.exception_type = 'RESCHEDULED' THEN r.new_date
        ELSE r.occurrence_date
      END AS actual_date,
      CASE
        WHEN r.exception_type IN ('RESCHEDULED','TIME_CHANGED') THEN r.new_start_time
        ELSE r.start_time
      END AS actual_start,
      CASE
        WHEN r.exception_type IN ('RESCHEDULED','TIME_CHANGED') THEN r.new_end_time
        ELSE r.end_time
      END AS actual_end,
      CASE
        WHEN r.exception_type IN ('RESCHEDULED','VENUE_CHANGED') THEN r.new_venue
        ELSE r.venue
      END AS actual_venue,
      CASE WHEN r.exception_type = 'CANCELLED' THEN TRUE ELSE FALSE END AS is_cancelled
    FROM resolved r
  )
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'schedule_id', f.schedule_id,
      'course_id', f.course_id,
      'course_code', f.course_code,
      'course_title', f.course_title,
      'date', f.actual_date,
      'start_time', f.actual_start,
      'end_time', f.actual_end,
      'venue', f.actual_venue,
      'exception_type', f.exception_type,
      'reason', f.reason
    )
  )
  INTO v_result
  FROM final_occurrences f
  WHERE f.actual_date >= v_today
    AND NOT f.is_cancelled
  ORDER BY f.actual_date, f.actual_start
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'data', NULL);
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 9. RPC: admin get schedules for their program/level
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_get_schedules(UUID) CASCADE;
CREATE FUNCTION public.admin_get_schedules(
  p_course_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_program TEXT;
  v_level TEXT;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'schedules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rs.id,
        'course_offering_id', rs.course_offering_id,
        'day_of_week', rs.day_of_week,
        'start_time', rs.start_time,
        'end_time', rs.end_time,
        'venue', rs.venue,
        'effective_start', rs.effective_start,
        'effective_end', rs.effective_end,
        'is_active', rs.is_active,
        'program_id', rs.program_id,
        'level', rs.level,
        'created_by', rs.created_by,
        'created_at', rs.created_at,
        'course_id', co.course_id,
        'course_code', c.code,
        'course_title', c.title,
        'semester_id', co.semester_id,
        'semester_name', s.name,
        'year_name', ay.name
      ) ORDER BY c.code, rs.day_of_week)
      FROM recurring_schedules rs
      JOIN course_offerings co ON co.id = rs.course_offering_id
      JOIN courses c ON c.id = co.course_id
      LEFT JOIN semesters s ON s.id = co.semester_id
      LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
      WHERE (v_role = 'super_admin' OR rs.program_id::text = v_program)
        AND (v_role = 'super_admin' OR rs.level = v_level)
        AND (p_course_id IS NULL OR co.course_id = p_course_id)
    ), '[]'::jsonb),
    'exceptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', se.id,
        'recurring_schedule_id', se.recurring_schedule_id,
        'occurrence_date', se.occurrence_date,
        'exception_type', se.exception_type,
        'new_date', se.new_date,
        'new_start_time', se.new_start_time,
        'new_end_time', se.new_end_time,
        'new_venue', se.new_venue,
        'reason', se.reason,
        'changed_by', se.changed_by,
        'created_at', se.created_at,
        'actor_name', p.full_name
      ) ORDER BY se.occurrence_date DESC)
      FROM schedule_exceptions se
      JOIN recurring_schedules rs ON rs.id = se.recurring_schedule_id
      JOIN course_offerings co ON co.id = rs.course_offering_id
      LEFT JOIN profiles p ON p.id = se.changed_by
      WHERE (v_role = 'super_admin' OR rs.program_id::text = v_program)
        AND (v_role = 'super_admin' OR rs.level = v_level)
        AND (p_course_id IS NULL OR co.course_id = p_course_id)
    ), '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- 10. RPC: admin create recurring schedule
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_create_recurring_schedule(UUID, INTEGER, TIME, TIME, TEXT, DATE, DATE) CASCADE;
CREATE FUNCTION public.admin_create_recurring_schedule(
  p_course_offering_id UUID,
  p_day_of_week  INTEGER,
  p_start_time   TIME,
  p_end_time     TIME,
  p_venue         TEXT,
  p_effective_start DATE,
  p_effective_end   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_program TEXT;
  v_level TEXT;
  v_offering RECORD;
  v_schedule_id UUID;
  v_new JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();

  SELECT * INTO v_offering FROM course_offerings WHERE id = p_course_offering_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Course offering not found.');
  END IF;

  IF v_role = 'admin' AND (
    v_offering.program_id::text <> v_program OR v_offering.level <> v_level
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only manage your own program.');
  END IF;

  IF p_end_time <= p_start_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION', 'message', 'End time must be after start time.');
  END IF;

  IF p_effective_end < p_effective_start THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION', 'message', 'Effective end must be on or after effective start.');
  END IF;

  INSERT INTO recurring_schedules (
    course_offering_id, day_of_week, start_time, end_time, venue,
    effective_start, effective_end, program_id, level, created_by
  ) VALUES (
    p_course_offering_id, p_day_of_week, p_start_time, p_end_time, p_venue,
    p_effective_start, p_effective_end,
    v_offering.program_id, v_offering.level, auth.uid()
  )
  RETURNING id INTO v_schedule_id;

  SELECT jsonb_build_object(
    'id', rs.id, 'course_offering_id', rs.course_offering_id,
    'day_of_week', rs.day_of_week, 'start_time', rs.start_time,
    'end_time', rs.end_time, 'venue', rs.venue,
    'effective_start', rs.effective_start, 'effective_end', rs.effective_end,
    'is_active', rs.is_active, 'program_id', rs.program_id, 'level', rs.level
  ) INTO v_new
  FROM recurring_schedules rs WHERE rs.id = v_schedule_id;

  INSERT INTO schedule_audit_log (actor_id, actor_name, action, schedule_id, course_id, new_values)
  SELECT auth.uid(), p.full_name, 'SCHEDULE_CREATED', v_schedule_id, v_offering.course_id, v_new
  FROM profiles p WHERE p.id = auth.uid();

  RETURN jsonb_build_object('success', true, 'data', v_new);
END;
$$;

-- ============================================================
-- 11. RPC: admin update recurring schedule
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_update_recurring_schedule(UUID, INTEGER, TIME, TIME, TEXT, DATE, DATE, BOOLEAN) CASCADE;
CREATE FUNCTION public.admin_update_recurring_schedule(
  p_schedule_id UUID,
  p_day_of_week  INTEGER DEFAULT NULL,
  p_start_time   TIME DEFAULT NULL,
  p_end_time     TIME DEFAULT NULL,
  p_venue         TEXT DEFAULT NULL,
  p_effective_start DATE DEFAULT NULL,
  p_effective_end   DATE DEFAULT NULL,
  p_is_active      BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_program TEXT;
  v_level TEXT;
  v_old RECORD;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();

  SELECT * INTO v_old FROM recurring_schedules WHERE id = p_schedule_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_role = 'admin' AND (v_old.program_id::text <> v_program OR v_old.level <> v_level) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT to_jsonb(v_old.*) - 'updated_at' INTO v_old_json;

  UPDATE recurring_schedules SET
    day_of_week     = COALESCE(p_day_of_week, day_of_week),
    start_time      = COALESCE(p_start_time, start_time),
    end_time        = COALESCE(p_end_time, end_time),
    venue           = COALESCE(p_venue, venue),
    effective_start = COALESCE(p_effective_start, effective_start),
    effective_end   = COALESCE(p_effective_end, effective_end),
    is_active       = COALESCE(p_is_active, is_active)
  WHERE id = p_schedule_id
  RETURNING to_jsonb(recurring_schedules.*) - 'updated_at' INTO v_new_json;

  INSERT INTO schedule_audit_log (actor_id, actor_name, action, schedule_id, course_id, original_values, new_values)
  SELECT auth.uid(), p.full_name, 'SCHEDULE_UPDATED', p_schedule_id, v_old.course_offering_id, v_old_json, v_new_json
  FROM profiles p WHERE p.id = auth.uid();

  RETURN jsonb_build_object('success', true, 'data', v_new_json);
END;
$$;

-- ============================================================
-- 12. RPC: admin create exception (reschedule/cancel/venue/time)
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_create_exception(UUID, DATE, TEXT, DATE, TIME, TIME, TEXT, TEXT) CASCADE;
CREATE FUNCTION public.admin_create_exception(
  p_schedule_id      UUID,
  p_occurrence_date  DATE,
  p_exception_type   TEXT,
  p_new_date         DATE DEFAULT NULL,
  p_new_start_time   TIME DEFAULT NULL,
  p_new_end_time     TIME DEFAULT NULL,
  p_new_venue        TEXT DEFAULT NULL,
  p_reason           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_program TEXT;
  v_level TEXT;
  v_old RECORD;
  v_exc_id UUID;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();

  SELECT * INTO v_old FROM recurring_schedules WHERE id = p_schedule_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Schedule not found.');
  END IF;

  IF v_role = 'admin' AND (v_old.program_id::text <> v_program OR v_old.level <> v_level) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Access denied.');
  END IF;

  IF p_exception_type NOT IN ('RESCHEDULED','CANCELLED','VENUE_CHANGED','TIME_CHANGED','SPECIAL_SESSION') THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION', 'message', 'Invalid exception type.');
  END IF;

  IF p_exception_type = 'RESCHEDULED' AND (p_new_date IS NULL OR p_new_start_time IS NULL OR p_new_end_time IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION', 'message', 'Reschedule requires new_date, new_start_time, new_end_time.');
  END IF;

  INSERT INTO schedule_exceptions (
    recurring_schedule_id, occurrence_date, exception_type,
    new_date, new_start_time, new_end_time, new_venue,
    reason, changed_by
  ) VALUES (
    p_schedule_id, p_occurrence_date, p_exception_type,
    p_new_date, p_new_start_time, p_new_end_time, p_new_venue,
    p_reason, auth.uid()
  )
  ON CONFLICT (recurring_schedule_id, occurrence_date) DO UPDATE SET
    exception_type = EXCLUDED.exception_type,
    new_date       = EXCLUDED.new_date,
    new_start_time = EXCLUDED.new_start_time,
    new_end_time   = EXCLUDED.new_end_time,
    new_venue      = EXCLUDED.new_venue,
    reason         = EXCLUDED.reason,
    changed_by     = EXCLUDED.changed_by
  RETURNING id INTO v_exc_id;

  SELECT to_jsonb(v_old.*) - 'updated_at' INTO v_old_json;

  SELECT jsonb_build_object(
    'id', se.id, 'exception_type', se.exception_type,
    'occurrence_date', se.occurrence_date, 'new_date', se.new_date,
    'new_start_time', se.new_start_time, 'new_end_time', se.new_end_time,
    'new_venue', se.new_venue, 'reason', se.reason
  ) INTO v_new_json
  FROM schedule_exceptions se WHERE se.id = v_exc_id;

  INSERT INTO schedule_audit_log (actor_id, actor_name, action, schedule_id, course_id, original_values, new_values, reason)
  SELECT auth.uid(), p.full_name, 'EXCEPTION_' || p_exception_type, p_schedule_id, v_old.course_offering_id, v_old_json, v_new_json, p_reason
  FROM profiles p WHERE p.id = auth.uid();

  RETURN jsonb_build_object('success', true, 'data', v_new_json);
END;
$$;

-- ============================================================
-- 13. RPC: admin delete exception
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_delete_exception(UUID) CASCADE;
CREATE FUNCTION public.admin_delete_exception(p_exception_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_exc RECORD;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT se.* INTO v_exc
  FROM schedule_exceptions se
  JOIN recurring_schedules rs ON rs.id = se.recurring_schedule_id
  WHERE se.id = p_exception_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  DELETE FROM schedule_exceptions WHERE id = p_exception_id;

  INSERT INTO schedule_audit_log (actor_id, actor_name, action, schedule_id, new_values, reason)
  SELECT auth.uid(), p.full_name, 'EXCEPTION_REMOVED', v_exc.recurring_schedule_id,
    jsonb_build_object('occurrence_date', v_exc.occurrence_date, 'exception_type', v_exc.exception_type),
    'Exception removed'
  FROM profiles p WHERE p.id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- Grants
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_timetable_range(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_class() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_schedules(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_recurring_schedule(UUID, INTEGER, TIME, TIME, TEXT, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_recurring_schedule(UUID, INTEGER, TIME, TIME, TEXT, DATE, DATE, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_exception(UUID, DATE, TEXT, DATE, TIME, TIME, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_exception(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_timetable_range(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_class() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_schedules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_recurring_schedule(UUID, INTEGER, TIME, TIME, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_recurring_schedule(UUID, INTEGER, TIME, TIME, TEXT, DATE, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_exception(UUID, DATE, TEXT, DATE, TIME, TIME, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_exception(UUID) TO authenticated;
