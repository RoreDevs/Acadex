-- 017: Advanced Attendance Analytics
-- ============================================================
-- Server-side aggregation RPCs so the frontend never pulls raw
-- attendance rows to compute simple statistics.
--
-- Adds a configurable attendance threshold setting:
--   attendance_threshold_percent  (default 75)  -> "students below
--   threshold" and "requires attention" flags are computed against it.
--
-- Rate convention (applied consistently everywhere):
--   * denominator  = "held" sessions: sessions that are NOT cancelled
--                    AND (closed early OR already ended).
--                    Future sessions and cancelled sessions never
--                    reduce attendance.
--   * numerator    = present + late + excused   (excused is not penalized)
--   * not-marked   = held session with no attendance record for the
--                    student -> treated as missed.
--   * rate = round((present + late + excused) / held * 100, 1)
--
-- DEPENDS ON migration 014 (sessions.semester_id) and 016 (status).
-- Run 014, then 016, then this file.
-- Idempotent: safe to re-run.
-- ============================================================

INSERT INTO settings (key, value) VALUES ('attendance_threshold_percent', '75')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 1. Student analytics (scoped to the calling student)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_attendance_analytics(
  p_semester_id UUID DEFAULT NULL,
  p_course_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_threshold INT;
  v_held INT;
  v_present INT;
  v_late INT;
  v_excused INT;
  v_absent INT;
  v_not_marked INT;
  v_overall JSONB;
  v_by_course JSONB;
  v_trend JSONB;
  v_trend_monthly JSONB;
  v_recent JSONB;
  v_last_5 JSONB;
  v_windows JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('student', 'admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Insufficient permissions to view attendance analytics.');
  END IF;

  v_threshold := COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_threshold_percent'), 75);

  CREATE TEMP TABLE _an_sess ON COMMIT DROP AS
  SELECT s.id, s.course_id, s.title, s.session_date, s.start_time, s.end_time
  FROM sessions s
  WHERE s.status <> 'cancelled'
    AND (s.status = 'closed' OR (s.session_date + s.end_time) <= now())
    AND s.course_id IN (SELECT course_id FROM enrollments WHERE student_id = auth.uid())
    AND (p_semester_id IS NULL OR s.semester_id = p_semester_id)
    AND (p_course_id IS NULL OR s.course_id = p_course_id);

  CREATE TEMP TABLE _an_att ON COMMIT DROP AS
  SELECT id, session_id, status, timestamp
  FROM attendance
  WHERE student_id = auth.uid()
    AND session_id IN (SELECT id FROM _an_sess);

  SELECT
    COUNT(*)::int,
    COUNT(a.session_id) FILTER (WHERE a.status = 'present')::int,
    COUNT(a.session_id) FILTER (WHERE a.status = 'late')::int,
    COUNT(a.session_id) FILTER (WHERE a.status = 'excused')::int,
    COUNT(a.session_id) FILTER (WHERE a.status = 'absent')::int,
    COUNT(*) FILTER (WHERE a.session_id IS NULL)::int
  INTO v_held, v_present, v_late, v_excused, v_absent, v_not_marked
  FROM _an_sess s
  LEFT JOIN _an_att a ON a.session_id = s.id;

  v_overall := jsonb_build_object(
    'held', v_held,
    'present', v_present,
    'late', v_late,
    'excused', v_excused,
    'absent', v_absent,
    'not_marked', v_not_marked,
    'attended', v_present + v_late + v_excused,
    'missed', v_absent + v_not_marked,
    'rate', CASE WHEN v_held > 0 THEN round((v_present + v_late + v_excused)::numeric / v_held * 100, 1) ELSE NULL END
  );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'course_id', x.course_id, 'code', x.code, 'title', x.title,
      'held', x.held,
      'present', x.present, 'late', x.late, 'excused', x.excused,
      'absent', x.absent, 'not_marked', x.not_marked,
      'attended', x.attended,
      'rate', CASE WHEN x.held > 0 THEN round(x.attended::numeric / x.held * 100, 1) ELSE NULL END
    ) ORDER BY x.held DESC, x.title ASC), '[]'::jsonb) INTO v_by_course
  FROM (
    SELECT s.course_id,
      MAX(c.code) AS code,
      MAX(c.title) AS title,
      COUNT(*)::int AS held,
      COUNT(a.session_id) FILTER (WHERE a.status = 'present')::int AS present,
      COUNT(a.session_id) FILTER (WHERE a.status = 'late')::int AS late,
      COUNT(a.session_id) FILTER (WHERE a.status = 'excused')::int AS excused,
      COUNT(a.session_id) FILTER (WHERE a.status = 'absent')::int AS absent,
      COUNT(*) FILTER (WHERE a.session_id IS NULL)::int AS not_marked,
      COUNT(a.session_id) FILTER (WHERE a.status IN ('present', 'late', 'excused'))::int AS attended
    FROM _an_sess s
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN _an_att a ON a.session_id = s.id
    GROUP BY s.course_id
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bucket', to_char(x.week_start, 'YYYY-MM-DD'),
      'label', to_char(x.week_start, 'Mon DD'),
      'held', x.held, 'attended', x.attended,
      'rate', CASE WHEN x.held > 0 THEN round(x.attended::numeric / x.held * 100, 1) ELSE NULL END
    ) ORDER BY x.week_start ASC), '[]'::jsonb) INTO v_trend
  FROM (
    SELECT date_trunc('week', (s.session_date + s.end_time))::date AS week_start,
      COUNT(*)::int AS held,
      COUNT(a.session_id) FILTER (WHERE a.status IN ('present', 'late', 'excused'))::int AS attended
    FROM _an_sess s
    LEFT JOIN _an_att a ON a.session_id = s.id
    WHERE (s.session_date + s.end_time) >= now() - interval '12 weeks'
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bucket', to_char(x.month_start, 'YYYY-MM'),
      'label', to_char(x.month_start, 'Mon YYYY'),
      'held', x.held, 'attended', x.attended,
      'rate', CASE WHEN x.held > 0 THEN round(x.attended::numeric / x.held * 100, 1) ELSE NULL END
    ) ORDER BY x.month_start ASC), '[]'::jsonb) INTO v_trend_monthly
  FROM (
    SELECT date_trunc('month', (s.session_date + s.end_time))::date AS month_start,
      COUNT(*)::int AS held,
      COUNT(a.session_id) FILTER (WHERE a.status IN ('present', 'late', 'excused'))::int AS attended
    FROM _an_sess s
    LEFT JOIN _an_att a ON a.session_id = s.id
    WHERE (s.session_date + s.end_time) >= now() - interval '24 months'
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id, 'session_id', a.session_id, 'title', a.title,
      'course_id', a.course_id, 'course_code', a.course_code, 'course_title', a.course_title,
      'session_date', a.session_date, 'start_time', a.start_time,
      'status', a.status, 'timestamp', a.timestamp
    ) ORDER BY a.session_date DESC, a.start_time DESC, a.timestamp DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT at.id, at.session_id, s.title, s.course_id,
           c.code AS course_code, c.title AS course_title,
           s.session_date, s.start_time, at.status, at.timestamp
    FROM _an_att at
    JOIN _an_sess s ON s.id = at.session_id
    JOIN courses c ON c.id = s.course_id
    ORDER BY s.session_date DESC, s.start_time DESC, at.timestamp DESC
    LIMIT 10
  ) a;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'session_id', x.session_id, 'session_date', x.session_date,
      'start_time', x.start_time, 'status', x.status
    ) ORDER BY x.session_date ASC, x.start_time ASC), '[]'::jsonb) INTO v_last_5
  FROM (
    SELECT s.id AS session_id, s.session_date, s.start_time,
           COALESCE(a.status, 'not_marked') AS status
    FROM _an_sess s
    LEFT JOIN _an_att a ON a.session_id = s.id
    ORDER BY s.session_date DESC, s.start_time DESC
    LIMIT 5
  ) x;

  SELECT jsonb_build_object(
    'recent', (SELECT jsonb_build_object(
        'held', COUNT(*)::int,
        'attended', COUNT(*) FILTER (WHERE status IN ('present', 'late', 'excused'))::int,
        'rate', round((COUNT(*) FILTER (WHERE status IN ('present', 'late', 'excused')))::numeric / NULLIF(COUNT(*), 0) * 100, 1)
      ) FROM (
        SELECT COALESCE(a.status, 'not_marked') AS status,
               ROW_NUMBER() OVER (ORDER BY s.session_date DESC, s.start_time DESC) AS rn
        FROM _an_sess s
        LEFT JOIN _an_att a ON a.session_id = s.id
      ) w
      WHERE rn <= 5),
    'previous', (SELECT jsonb_build_object(
        'held', COUNT(*)::int,
        'attended', COUNT(*) FILTER (WHERE status IN ('present', 'late', 'excused'))::int,
        'rate', round((COUNT(*) FILTER (WHERE status IN ('present', 'late', 'excused')))::numeric / NULLIF(COUNT(*), 0) * 100, 1)
      ) FROM (
        SELECT COALESCE(a.status, 'not_marked') AS status,
               ROW_NUMBER() OVER (ORDER BY s.session_date DESC, s.start_time DESC) AS rn
        FROM _an_sess s
        LEFT JOIN _an_att a ON a.session_id = s.id
      ) w
      WHERE rn BETWEEN 6 AND 10)
  ) INTO v_windows;

  RETURN jsonb_build_object(
    'success', true,
    'threshold', v_threshold,
    'overall', v_overall,
    'by_course', v_by_course,
    'trend', v_trend,
    'trend_monthly', v_trend_monthly,
    'recent', v_recent,
    'last_5', v_last_5,
    'windows', COALESCE(v_windows, jsonb_build_object('recent', NULL, 'previous', NULL))
  );
END;
$$;

-- ============================================================
-- 2. Course analytics (admin / super_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_course_attendance_analytics(p_course_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_threshold INT;
  v_course RECORD;
  v_enrolled INT;
  v_held INT;
  v_present INT;
  v_late INT;
  v_excused INT;
  v_absent INT;
  v_not_marked INT;
  v_possible INT;
  v_rate NUMERIC;
  v_avg_student_rate NUMERIC;
  v_by_session JSONB;
  v_by_student JSONB;
  v_trend JSONB;
  v_recent JSONB;
  v_alerts_below JSONB := '[]'::jsonb;
  v_alerts_low JSONB := '[]'::jsonb;
  v_alerts_rep JSONB := '[]'::jsonb;
  v_alerts_decline JSONB := '[]'::jsonb;
  v_alerts JSONB;
  v_recent_avg NUMERIC;
  v_prev_avg NUMERIC;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only admins can view course analytics.');
  END IF;

  SELECT c.*, p.name AS program_name
  INTO v_course
  FROM courses c
  JOIN programs p ON p.id = c.program_id
  WHERE c.id = p_course_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'COURSE_NOT_FOUND', 'message', 'Course not found.');
  END IF;

  IF v_role = 'admin' AND v_course.program_id::text <> (SELECT program FROM profiles WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only view analytics for your own program.');
  END IF;

  v_threshold := COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_threshold_percent'), 75);

  SELECT COUNT(*) INTO v_enrolled FROM enrollments WHERE course_id = p_course_id;

  CREATE TEMP TABLE _cax_sess ON COMMIT DROP AS
  SELECT id, title, session_date, start_time, end_time, status
  FROM sessions
  WHERE course_id = p_course_id
    AND status <> 'cancelled'
    AND (status = 'closed' OR (session_date + end_time) <= now());

  CREATE TEMP TABLE _cax_att ON COMMIT DROP AS
  SELECT session_id, student_id, status
  FROM attendance
  WHERE session_id IN (SELECT id FROM _cax_sess);

  v_held := (SELECT COUNT(*) FROM _cax_sess);
  v_possible := v_enrolled * v_held;

  SELECT
    COUNT(*) FILTER (WHERE status = 'present')::int,
    COUNT(*) FILTER (WHERE status = 'late')::int,
    COUNT(*) FILTER (WHERE status = 'excused')::int,
    COUNT(*) FILTER (WHERE status = 'absent')::int
  INTO v_present, v_late, v_excused, v_absent
  FROM _cax_att;

  v_not_marked := GREATEST(0, v_possible - v_present - v_late - v_excused - v_absent);
  v_rate := CASE WHEN v_possible > 0 THEN round((v_present + v_late + v_excused)::numeric / v_possible * 100, 1) ELSE NULL END;

  CREATE TEMP TABLE _cax_sessions ON COMMIT DROP AS
  SELECT s.id AS session_id, s.title, s.session_date, s.start_time, s.status,
    COUNT(a.session_id)::int AS total_records,
    COUNT(a.session_id) FILTER (WHERE a.status = 'present')::int AS present,
    COUNT(a.session_id) FILTER (WHERE a.status = 'late')::int AS late,
    COUNT(a.session_id) FILTER (WHERE a.status = 'excused')::int AS excused,
    COUNT(a.session_id) FILTER (WHERE a.status = 'absent')::int AS absent,
    COUNT(a.session_id) FILTER (WHERE a.status IN ('present', 'late', 'excused'))::int AS attended,
    GREATEST(0, v_enrolled - COUNT(a.session_id))::int AS not_marked,
    CASE WHEN v_enrolled > 0 THEN round((COUNT(a.session_id) FILTER (WHERE a.status IN ('present', 'late', 'excused')))::numeric / v_enrolled * 100, 1) ELSE NULL END AS rate
  FROM _cax_sess s
  LEFT JOIN _cax_att a ON a.session_id = s.id
  GROUP BY s.id, s.title, s.session_date, s.start_time, s.status;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'session_id', r.session_id, 'title', r.title, 'session_date', r.session_date,
      'start_time', r.start_time, 'status', r.status,
      'present', r.present, 'late', r.late, 'excused', r.excused, 'absent', r.absent,
      'not_marked', r.not_marked, 'attended', r.attended, 'rate', r.rate
    ) ORDER BY r.session_date DESC, r.start_time DESC), '[]'::jsonb) INTO v_by_session
  FROM _cax_sessions r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'session_id', r.session_id, 'title', r.title, 'session_date', r.session_date,
      'start_time', r.start_time, 'status', r.status,
      'present', r.present, 'late', r.late, 'excused', r.excused, 'absent', r.absent,
      'not_marked', r.not_marked, 'attended', r.attended, 'rate', r.rate
    ) ORDER BY r.session_date DESC, r.start_time DESC), '[]'::jsonb) INTO v_recent
  FROM (SELECT * FROM _cax_sessions ORDER BY session_date DESC, start_time DESC LIMIT 10) r;

  CREATE TEMP TABLE _cax_students ON COMMIT DROP AS
  SELECT p.id AS student_id, p.full_name, p.index_number,
    COALESCE(st.present, 0)::int AS present,
    COALESCE(st.late, 0)::int AS late,
    COALESCE(st.excused, 0)::int AS excused,
    COALESCE(st.absent, 0)::int AS absent,
    COALESCE(st.attended, 0)::int AS attended,
    CASE WHEN v_held > 0 THEN round(COALESCE(st.attended, 0)::numeric / v_held * 100, 1) ELSE NULL END AS rate
  FROM enrollments e
  JOIN profiles p ON p.id = e.student_id
  LEFT JOIN (
    SELECT student_id,
      COUNT(*) FILTER (WHERE status = 'present')::int AS present,
      COUNT(*) FILTER (WHERE status = 'late')::int AS late,
      COUNT(*) FILTER (WHERE status = 'excused')::int AS excused,
      COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
      COUNT(*) FILTER (WHERE status IN ('present', 'late', 'excused'))::int AS attended
    FROM _cax_att
    GROUP BY student_id
  ) st ON st.student_id = e.student_id
  WHERE e.course_id = p_course_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'student_id', s.student_id, 'full_name', s.full_name, 'index_number', s.index_number,
      'present', s.present, 'late', s.late, 'excused', s.excused, 'absent', s.absent,
      'attended', s.attended, 'held', s.held, 'rate', s.rate,
      'below_threshold', s.rate IS NOT NULL AND s.rate < v_threshold
    ) ORDER BY s.rate DESC NULLS LAST, s.full_name ASC), '[]'::jsonb) INTO v_by_student
  FROM (
    SELECT st.*, v_held::int AS held FROM _cax_students st
  ) s;

  SELECT round(AVG(rate), 1) INTO v_avg_student_rate FROM _cax_students WHERE rate IS NOT NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bucket', to_char(x.week_start, 'YYYY-MM-DD'),
      'label', to_char(x.week_start, 'Mon DD'),
      'held', x.held, 'attended', x.attended,
      'rate', CASE WHEN x.held > 0 AND v_enrolled > 0 THEN round(x.attended::numeric / (x.held * v_enrolled) * 100, 1) ELSE NULL END
    ) ORDER BY x.week_start ASC), '[]'::jsonb) INTO v_trend
  FROM (
    SELECT date_trunc('week', (s.session_date + s.end_time))::date AS week_start,
      COUNT(*)::int AS held,
      COUNT(a.session_id) FILTER (WHERE a.status IN ('present', 'late', 'excused'))::int AS attended
    FROM _cax_sess s
    LEFT JOIN _cax_att a ON a.session_id = s.id
    WHERE (s.session_date + s.end_time) >= now() - interval '12 weeks'
    GROUP BY 1
  ) x;

  -- Alerts: students below threshold
  v_alerts_below := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'type', 'below_threshold', 'severity', 'warning', 'count', COUNT(*)::int,
      'message', COUNT(*)::text || ' student' || CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END || ' below the ' || v_threshold || '% attendance threshold.'
    ))
    FROM _cax_students WHERE rate IS NOT NULL AND rate < v_threshold
  ), '[]'::jsonb);

  -- Alerts: unusually low session attendance
  v_alerts_low := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'type', 'low_session', 'severity', 'warning',
      'session_id', session_id, 'title', title, 'session_date', session_date, 'rate', rate,
      'message', '"' || title || '" on ' || to_char(session_date, 'Mon DD, YYYY') || ' had only ' || COALESCE(round(rate, 0)::text, '0') || '% attendance.'
    ))
    FROM _cax_sessions WHERE rate IS NOT NULL AND rate < v_threshold
  ), '[]'::jsonb);

  -- Alerts: repeated absences (>=3 consecutive absent marks)
  v_alerts_rep := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'type', 'repeated_absence', 'severity', 'warning',
      'student_id', st.student_id, 'full_name', st.full_name, 'index_number', st.index_number,
      'max_run', d.max_run,
      'message', st.full_name || ' (' || st.index_number || ') has ' || d.max_run || ' consecutive absences.'
    ))
    FROM (
      SELECT student_id, MAX(run_len)::int AS max_run
      FROM (
        SELECT student_id, rn - rn_status AS grp, COUNT(*) AS run_len
        FROM (
          SELECT a.student_id, a.status, s.session_date,
                 ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY s.session_date, s.start_time) AS rn,
                 ROW_NUMBER() OVER (PARTITION BY a.student_id, a.status ORDER BY s.session_date, s.start_time) AS rn_status
          FROM _cax_att a
          JOIN _cax_sess s ON s.id = a.session_id
        ) b
        WHERE b.status = 'absent'
        GROUP BY student_id, rn - rn_status
      ) c
      GROUP BY student_id
      HAVING MAX(run_len) >= 3
    ) d
    JOIN _cax_students st ON st.student_id = d.student_id
  ), '[]'::jsonb);

  -- Alerts: attendance decline over the last 3 sessions vs the 3 before
  IF v_held >= 6 THEN
    SELECT AVG(rate) INTO v_recent_avg
    FROM (SELECT rate, ROW_NUMBER() OVER (ORDER BY session_date DESC, start_time DESC) AS rn FROM _cax_sessions) r
    WHERE rn <= 3 AND rate IS NOT NULL;

    SELECT AVG(rate) INTO v_prev_avg
    FROM (SELECT rate, ROW_NUMBER() OVER (ORDER BY session_date DESC, start_time DESC) AS rn FROM _cax_sessions) r
    WHERE rn BETWEEN 4 AND 6 AND rate IS NOT NULL;

    IF v_recent_avg IS NOT NULL AND v_prev_avg IS NOT NULL AND (v_recent_avg - v_prev_avg) <= -10 THEN
      v_alerts_decline := jsonb_build_array(jsonb_build_object(
        'type', 'decline', 'severity', 'info',
        'delta', round(v_recent_avg - v_prev_avg, 1),
        'message', 'Average session attendance fell ' || round(abs(v_recent_avg - v_prev_avg), 1)::text || ' points over the last 3 sessions compared with the 3 before.'
      ));
    END IF;
  END IF;

  v_alerts := v_alerts_below || v_alerts_low || v_alerts_rep || v_alerts_decline;

  RETURN jsonb_build_object(
    'success', true,
    'threshold', v_threshold,
    'course', jsonb_build_object('id', v_course.id, 'code', v_course.code, 'title', v_course.title, 'program_name', v_course.program_name),
    'enrolled', v_enrolled, 'held', v_held, 'possible', v_possible,
    'present', v_present, 'late', v_late, 'excused', v_excused, 'absent', v_absent,
    'not_marked', v_not_marked,
    'attended', v_present + v_late + v_excused,
    'missed', v_not_marked + v_absent,
    'rate', v_rate,
    'average_student_rate', v_avg_student_rate,
    'by_session', v_by_session,
    'by_student', v_by_student,
    'trend', v_trend,
    'recent', v_recent,
    'alerts', v_alerts
  );
END;
$$;

-- ============================================================
-- 3. Admin program overview (admin / super_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_attendance_overview(
  p_semester_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
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
  v_threshold INT;
  v_students INT;
  v_held INT;
  v_possible INT;
  v_present INT;
  v_late INT;
  v_excused INT;
  v_absent INT;
  v_not_marked INT;
  v_by_course JSONB;
  v_students_below JSONB;
  v_trend JSONB;
  v_recent JSONB;
  v_alerts_below JSONB := '[]'::jsonb;
  v_alerts_low JSONB := '[]'::jsonb;
  v_alerts_rep JSONB := '[]'::jsonb;
  v_alerts_decline JSONB := '[]'::jsonb;
  v_alerts JSONB;
  v_recent_avg NUMERIC;
  v_prev_avg NUMERIC;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only admins can view attendance analytics.');
  END IF;

  SELECT program, level INTO v_program, v_level FROM profiles WHERE id = auth.uid();

  v_threshold := COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_threshold_percent'), 75);

  CREATE TEMP TABLE _ov_sess ON COMMIT DROP AS
  SELECT s.id, s.course_id, s.title, s.session_date, s.start_time, s.end_time, s.status, s.program_id, s.level, s.semester_id
  FROM sessions s
  WHERE s.status <> 'cancelled'
    AND (s.status = 'closed' OR (s.session_date + s.end_time) <= now())
    AND (v_role <> 'admin' OR s.program_id::text = v_program)
    AND (v_role <> 'admin' OR s.level = v_level)
    AND (p_semester_id IS NULL OR s.semester_id = p_semester_id)
    AND (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date);

  CREATE TEMP TABLE _ov_eligible ON COMMIT DROP AS
  SELECT s.id AS session_id, e.student_id
  FROM _ov_sess s
  JOIN enrollments e ON e.course_id = s.course_id
  JOIN profiles p ON p.id = e.student_id AND p.role = 'student'
  WHERE (v_role <> 'admin' OR p.program = v_program)
    AND (v_role <> 'admin' OR p.level = v_level);

  CREATE TEMP TABLE _ov_att ON COMMIT DROP AS
  SELECT a.session_id, a.student_id, a.status
  FROM attendance a
  JOIN _ov_eligible el ON el.session_id = a.session_id AND el.student_id = a.student_id;

  v_students := (SELECT COUNT(DISTINCT student_id)::int FROM _ov_eligible);
  v_held := (SELECT COUNT(*)::int FROM _ov_sess);
  v_possible := (SELECT COUNT(*)::int FROM _ov_eligible);

  SELECT
    COUNT(*) FILTER (WHERE status = 'present')::int,
    COUNT(*) FILTER (WHERE status = 'late')::int,
    COUNT(*) FILTER (WHERE status = 'excused')::int,
    COUNT(*) FILTER (WHERE status = 'absent')::int
  INTO v_present, v_late, v_excused, v_absent
  FROM _ov_att;

  v_not_marked := GREATEST(0, v_possible - v_present - v_late - v_excused - v_absent);

  -- Per student per course (used for per-course below-threshold counts and student overall rates)
  CREATE TEMP TABLE _ov_student_course ON COMMIT DROP AS
  SELECT s.course_id, el.student_id,
    COUNT(*)::int AS held,
    COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
    CASE WHEN COUNT(*) > 0 THEN round((COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused')))::numeric / COUNT(*) * 100, 1) ELSE NULL END AS rate
  FROM _ov_sess s
  JOIN _ov_eligible el ON el.session_id = s.id
  LEFT JOIN _ov_att at ON at.session_id = s.id AND at.student_id = el.student_id
  GROUP BY s.course_id, el.student_id;

  CREATE TEMP TABLE _ov_students ON COMMIT DROP AS
  SELECT sc.student_id, p.full_name, p.index_number,
    SUM(sc.held)::int AS held,
    SUM(sc.attended)::int AS attended,
    CASE WHEN SUM(sc.held) > 0 THEN round(SUM(sc.attended)::numeric / SUM(sc.held) * 100, 1) ELSE NULL END AS rate
  FROM _ov_student_course sc
  JOIN profiles p ON p.id = sc.student_id
  GROUP BY sc.student_id, p.full_name, p.index_number;

  CREATE TEMP TABLE _ov_sessions ON COMMIT DROP AS
  SELECT s.id AS session_id, s.title, s.session_date, s.start_time, s.status,
    s.course_id, c.code AS course_code, c.title AS course_title,
    COUNT(el.student_id)::int AS eligible,
    COUNT(at.session_id) FILTER (WHERE at.status = 'present')::int AS present,
    COUNT(at.session_id) FILTER (WHERE at.status = 'late')::int AS late,
    COUNT(at.session_id) FILTER (WHERE at.status = 'absent')::int AS absent,
    COUNT(at.session_id) FILTER (WHERE at.status = 'excused')::int AS excused,
    COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
    CASE WHEN COUNT(el.student_id) > 0 THEN round((COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused')))::numeric / COUNT(el.student_id) * 100, 1) ELSE NULL END AS rate
  FROM _ov_sess s
  JOIN courses c ON c.id = s.course_id
  LEFT JOIN _ov_eligible el ON el.session_id = s.id
  LEFT JOIN _ov_att at ON at.session_id = s.id AND at.student_id = el.student_id
  GROUP BY s.id, s.title, s.session_date, s.start_time, s.status, s.course_id, c.code, c.title;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'course_id', x.course_id, 'code', x.code, 'title', x.title,
      'enrolled', x.enrolled, 'held', x.held, 'attended', x.attended, 'possible', x.possible,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END,
      'below_threshold', x.below_threshold
    ) ORDER BY x.held DESC, x.title ASC), '[]'::jsonb) INTO v_by_course
  FROM (
    SELECT s.course_id,
      MAX(c.code) AS code,
      MAX(c.title) AS title,
      COUNT(DISTINCT el.student_id)::int AS enrolled,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
      COUNT(el.student_id)::int AS possible,
      (SELECT COUNT(*)::int FROM _ov_student_course sc WHERE sc.course_id = s.course_id AND sc.rate IS NOT NULL AND sc.rate < v_threshold) AS below_threshold
    FROM _ov_sess s
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN _ov_eligible el ON el.session_id = s.id
    LEFT JOIN _ov_att at ON at.session_id = s.id AND at.student_id = el.student_id
    GROUP BY s.course_id
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'student_id', x.student_id, 'full_name', x.full_name, 'index_number', x.index_number,
      'held', x.held, 'attended', x.attended, 'rate', x.rate
    ) ORDER BY x.rate ASC NULLS LAST, x.full_name ASC), '[]'::jsonb) INTO v_students_below
  FROM (SELECT * FROM _ov_students WHERE rate IS NOT NULL AND rate < v_threshold ORDER BY rate ASC LIMIT 100) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bucket', to_char(x.week_start, 'YYYY-MM-DD'),
      'label', to_char(x.week_start, 'Mon DD'),
      'held', x.held, 'attended', x.attended,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END
    ) ORDER BY x.week_start ASC), '[]'::jsonb) INTO v_trend
  FROM (
    SELECT date_trunc('week', (s.session_date + s.end_time))::date AS week_start,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(el.student_id)::int AS possible,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended
    FROM _ov_sess s
    LEFT JOIN _ov_eligible el ON el.session_id = s.id
    LEFT JOIN _ov_att at ON at.session_id = s.id AND at.student_id = el.student_id
    WHERE (s.session_date + s.end_time) >= now() - interval '12 weeks'
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'session_id', r.session_id, 'title', r.title, 'session_date', r.session_date,
      'start_time', r.start_time, 'status', r.status, 'course_id', r.course_id,
      'course_code', r.course_code, 'course_title', r.course_title,
      'present', r.present, 'late', r.late, 'absent', r.absent, 'excused', r.excused,
      'eligible', r.eligible, 'rate', r.rate
    ) ORDER BY r.session_date DESC, r.start_time DESC), '[]'::jsonb) INTO v_recent
  FROM (SELECT * FROM _ov_sessions ORDER BY session_date DESC, start_time DESC LIMIT 10) r;

  v_alerts_below := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'type', 'below_threshold', 'severity', 'warning', 'count', COUNT(*)::int,
      'message', COUNT(*)::text || ' student' || CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END || ' below the ' || v_threshold || '% attendance threshold.'
    ))
    FROM _ov_students WHERE rate IS NOT NULL AND rate < v_threshold
  ), '[]'::jsonb);

  v_alerts_low := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'type', 'low_session', 'severity', 'warning',
      'session_id', session_id, 'title', title, 'session_date', session_date, 'rate', rate,
      'message', '"' || title || '" on ' || to_char(session_date, 'Mon DD, YYYY') || ' had only ' || COALESCE(round(rate, 0)::text, '0') || '% attendance.'
    ))
    FROM _ov_sessions WHERE rate IS NOT NULL AND rate < v_threshold
  ), '[]'::jsonb);

  v_alerts_rep := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'type', 'repeated_absence', 'severity', 'warning',
      'student_id', st.student_id, 'full_name', st.full_name, 'index_number', st.index_number,
      'max_run', d.max_run,
      'message', st.full_name || ' (' || st.index_number || ') has ' || d.max_run || ' consecutive absences.'
    ))
    FROM (
      SELECT student_id, MAX(run_len)::int AS max_run
      FROM (
        SELECT student_id, rn - rn_status AS grp, COUNT(*) AS run_len
        FROM (
          SELECT a.student_id, a.status, s.session_date,
                 ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY s.session_date, s.start_time) AS rn,
                 ROW_NUMBER() OVER (PARTITION BY a.student_id, a.status ORDER BY s.session_date, s.start_time) AS rn_status
          FROM _ov_att a
          JOIN _ov_sess s ON s.id = a.session_id
        ) b
        WHERE b.status = 'absent'
        GROUP BY student_id, rn - rn_status
      ) c
      GROUP BY student_id
      HAVING MAX(run_len) >= 3
    ) d
    JOIN _ov_students st ON st.student_id = d.student_id
  ), '[]'::jsonb);

  IF v_held >= 6 THEN
    SELECT AVG(rate) INTO v_recent_avg
    FROM (SELECT rate, ROW_NUMBER() OVER (ORDER BY session_date DESC, start_time DESC) AS rn FROM _ov_sessions) r
    WHERE rn <= 3 AND rate IS NOT NULL;

    SELECT AVG(rate) INTO v_prev_avg
    FROM (SELECT rate, ROW_NUMBER() OVER (ORDER BY session_date DESC, start_time DESC) AS rn FROM _ov_sessions) r
    WHERE rn BETWEEN 4 AND 6 AND rate IS NOT NULL;

    IF v_recent_avg IS NOT NULL AND v_prev_avg IS NOT NULL AND (v_recent_avg - v_prev_avg) <= -10 THEN
      v_alerts_decline := jsonb_build_array(jsonb_build_object(
        'type', 'decline', 'severity', 'info',
        'delta', round(v_recent_avg - v_prev_avg, 1),
        'message', 'Average session attendance fell ' || round(abs(v_recent_avg - v_prev_avg), 1)::text || ' points over the last 3 sessions compared with the 3 before.'
      ));
    END IF;
  END IF;

  v_alerts := v_alerts_below || v_alerts_low || v_alerts_rep || v_alerts_decline;

  RETURN jsonb_build_object(
    'success', true,
    'threshold', v_threshold,
    'totals', jsonb_build_object(
      'students', v_students, 'held', v_held, 'possible', v_possible,
      'present', v_present, 'late', v_late, 'excused', v_excused, 'absent', v_absent,
      'not_marked', v_not_marked,
      'attended', v_present + v_late + v_excused,
      'missed', v_not_marked + v_absent,
      'rate', CASE WHEN v_possible > 0 THEN round((v_present + v_late + v_excused)::numeric / v_possible * 100, 1) ELSE NULL END
    ),
    'by_course', v_by_course,
    'students_below_threshold', v_students_below,
    'trend', v_trend,
    'recent', v_recent,
    'alerts', v_alerts
  );
END;
$$;

-- ============================================================
-- 4. Super admin system analytics (no personal data)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_super_admin_attendance_analytics(
  p_semester_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_threshold INT;
  v_students INT;
  v_held INT;
  v_possible INT;
  v_present INT;
  v_late INT;
  v_excused INT;
  v_absent INT;
  v_not_marked INT;
  v_by_program JSONB;
  v_by_level JSONB;
  v_by_course JSONB;
  v_by_semester JSONB;
  v_trend JSONB;
  v_recent JSONB;
BEGIN
  SELECT get_user_role() INTO v_role;
  IF v_role IS NULL OR v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only super admins can view system analytics.');
  END IF;

  v_threshold := COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'attendance_threshold_percent'), 75);
  v_students := (SELECT COUNT(*)::int FROM profiles WHERE role = 'student');

  CREATE TEMP TABLE _sa_sess ON COMMIT DROP AS
  SELECT s.id, s.course_id, s.session_date, s.start_time, s.end_time, s.status, s.program_id, s.level, s.semester_id
  FROM sessions s
  WHERE s.status <> 'cancelled'
    AND (s.status = 'closed' OR (s.session_date + s.end_time) <= now())
    AND (p_semester_id IS NULL OR s.semester_id = p_semester_id)
    AND (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date);

  CREATE TEMP TABLE _sa_eligible ON COMMIT DROP AS
  SELECT s.id AS session_id, e.student_id
  FROM _sa_sess s
  JOIN enrollments e ON e.course_id = s.course_id
  JOIN profiles p ON p.id = e.student_id AND p.role = 'student';

  CREATE TEMP TABLE _sa_att ON COMMIT DROP AS
  SELECT a.session_id, a.student_id, a.status
  FROM attendance a
  JOIN _sa_eligible el ON el.session_id = a.session_id AND el.student_id = a.student_id;

  v_held := (SELECT COUNT(*)::int FROM _sa_sess);
  v_possible := (SELECT COUNT(*)::int FROM _sa_eligible);

  SELECT
    COUNT(*) FILTER (WHERE status = 'present')::int,
    COUNT(*) FILTER (WHERE status = 'late')::int,
    COUNT(*) FILTER (WHERE status = 'excused')::int,
    COUNT(*) FILTER (WHERE status = 'absent')::int
  INTO v_present, v_late, v_excused, v_absent
  FROM _sa_att;

  v_not_marked := GREATEST(0, v_possible - v_present - v_late - v_excused - v_absent);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'program_id', x.program_id, 'name', x.name, 'code', x.code,
      'students', x.students, 'held', x.held, 'attended', x.attended, 'possible', x.possible,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END
    ) ORDER BY x.held DESC), '[]'::jsonb) INTO v_by_program
  FROM (
    SELECT s.program_id, MAX(pr.name) AS name, MAX(pr.code) AS code,
      COUNT(DISTINCT el.student_id)::int AS students,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
      COUNT(el.student_id)::int AS possible
    FROM _sa_sess s
    JOIN programs pr ON pr.id = s.program_id
    LEFT JOIN _sa_eligible el ON el.session_id = s.id
    LEFT JOIN _sa_att at ON at.session_id = s.id AND at.student_id = el.student_id
    GROUP BY s.program_id
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'level', x.level,
      'students', x.students, 'held', x.held, 'attended', x.attended, 'possible', x.possible,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END
    ) ORDER BY x.level ASC), '[]'::jsonb) INTO v_by_level
  FROM (
    SELECT s.level,
      COUNT(DISTINCT el.student_id)::int AS students,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
      COUNT(el.student_id)::int AS possible
    FROM _sa_sess s
    LEFT JOIN _sa_eligible el ON el.session_id = s.id
    LEFT JOIN _sa_att at ON at.session_id = s.id AND at.student_id = el.student_id
    GROUP BY s.level
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'course_id', x.course_id, 'code', x.code, 'title', x.title,
      'program_name', x.program_name,
      'held', x.held, 'attended', x.attended, 'possible', x.possible,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END
    ) ORDER BY x.held DESC, x.title ASC), '[]'::jsonb) INTO v_by_course
  FROM (
    SELECT s.course_id, MAX(c.code) AS code, MAX(c.title) AS title,
      MAX(pr.name) AS program_name,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
      COUNT(el.student_id)::int AS possible
    FROM _sa_sess s
    JOIN courses c ON c.id = s.course_id
    JOIN programs pr ON pr.id = c.program_id
    LEFT JOIN _sa_eligible el ON el.session_id = s.id
    LEFT JOIN _sa_att at ON at.session_id = s.id AND at.student_id = el.student_id
    GROUP BY s.course_id
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'semester_id', x.semester_id, 'name', x.name, 'year_name', x.year_name,
      'held', x.held, 'attended', x.attended, 'possible', x.possible,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END
    ) ORDER BY x.semester_id IS NULL, x.year_name ASC, x.name ASC), '[]'::jsonb) INTO v_by_semester
  FROM (
    SELECT s.semester_id, MAX(se.name) AS name, MAX(ay.name) AS year_name,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended,
      COUNT(el.student_id)::int AS possible
    FROM _sa_sess s
    LEFT JOIN semesters se ON se.id = s.semester_id
    LEFT JOIN academic_years ay ON ay.id = se.academic_year_id
    LEFT JOIN _sa_eligible el ON el.session_id = s.id
    LEFT JOIN _sa_att at ON at.session_id = s.id AND at.student_id = el.student_id
    GROUP BY s.semester_id
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bucket', to_char(x.week_start, 'YYYY-MM-DD'),
      'label', to_char(x.week_start, 'Mon DD'),
      'held', x.held, 'attended', x.attended,
      'rate', CASE WHEN x.possible > 0 THEN round(x.attended::numeric / x.possible * 100, 1) ELSE NULL END
    ) ORDER BY x.week_start ASC), '[]'::jsonb) INTO v_trend
  FROM (
    SELECT date_trunc('week', (s.session_date + s.end_time))::date AS week_start,
      COUNT(DISTINCT s.id)::int AS held,
      COUNT(el.student_id)::int AS possible,
      COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused'))::int AS attended
    FROM _sa_sess s
    LEFT JOIN _sa_eligible el ON el.session_id = s.id
    LEFT JOIN _sa_att at ON at.session_id = s.id AND at.student_id = el.student_id
    WHERE (s.session_date + s.end_time) >= now() - interval '12 weeks'
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'session_id', x.session_id, 'title', x.title, 'session_date', x.session_date,
      'course_code', x.course_code, 'program_name', x.program_name,
      'present', x.present, 'late', x.late, 'absent', x.absent, 'eligible', x.eligible,
      'rate', x.rate
    ) ORDER BY x.session_date DESC, x.start_time DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT s.id AS session_id, s.title, s.session_date, s.start_time,
      c.code AS course_code, pr.name AS program_name,
      COUNT(at.session_id) FILTER (WHERE at.status = 'present')::int AS present,
      COUNT(at.session_id) FILTER (WHERE at.status = 'late')::int AS late,
      COUNT(at.session_id) FILTER (WHERE at.status = 'absent')::int AS absent,
      COUNT(el.student_id)::int AS eligible,
      CASE WHEN COUNT(el.student_id) > 0 THEN round((COUNT(at.session_id) FILTER (WHERE at.status IN ('present', 'late', 'excused')))::numeric / COUNT(el.student_id) * 100, 1) ELSE NULL END AS rate
    FROM _sa_sess s
    JOIN courses c ON c.id = s.course_id
    JOIN programs pr ON pr.id = c.program_id
    LEFT JOIN _sa_eligible el ON el.session_id = s.id
    LEFT JOIN _sa_att at ON at.session_id = s.id AND at.student_id = el.student_id
    GROUP BY s.id, s.title, s.session_date, s.start_time, c.code, pr.name
    ORDER BY s.session_date DESC, s.start_time DESC
    LIMIT 10
  ) x;

  RETURN jsonb_build_object(
    'success', true,
    'threshold', v_threshold,
    'totals', jsonb_build_object(
      'students', v_students, 'held', v_held, 'possible', v_possible,
      'present', v_present, 'late', v_late, 'excused', v_excused, 'absent', v_absent,
      'not_marked', v_not_marked,
      'attended', v_present + v_late + v_excused,
      'missed', v_not_marked + v_absent,
      'rate', CASE WHEN v_possible > 0 THEN round((v_present + v_late + v_excused)::numeric / v_possible * 100, 1) ELSE NULL END
    ),
    'by_program', v_by_program,
    'by_level', v_by_level,
    'by_course', v_by_course,
    'by_semester', v_by_semester,
    'trend', v_trend,
    'recent', v_recent
  );
END;
$$;

-- ============================================================
-- Grants
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_student_attendance_analytics(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_course_attendance_analytics(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_attendance_overview(UUID, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_attendance_analytics(UUID, DATE, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_student_attendance_analytics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_attendance_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_attendance_overview(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_attendance_analytics(UUID, DATE, DATE) TO authenticated;
