-- 020: Advance academic period as part of class promotion
-- ============================================================
-- Lets a Super Admin promotion roll the current academic period
-- forward (e.g. 2025/2026 Semester 2 -> 2026/2027 Semester 1) in the
-- same action that moves students up a level.
--
-- Safety rules (do NOT "fix" these into auto-everything):
--   * Advances AT MOST ONCE per academic cycle. Promoting several
--     classes (100->200, then 200->300, ...) must NOT skip semesters.
--     A settings guard records the semester we rolled TO; further
--     promotions skip advancement until the period is changed manually.
--   * NEVER creates academic years or semesters. If no next semester
--     exists, the promotion still succeeds and the caller is told to
--     create it in Academic Periods.
--   * Reuses set_current_semester so current-period invariants hold.
--
-- Idempotent: safe to re-run (CREATE OR REPLACE + grants).
-- ============================================================

CREATE OR REPLACE FUNCTION public.advance_academic_period_for_promotion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur RECORD;
  v_next_id UUID;
  v_next_year TEXT;
  v_next_sem TEXT;
  v_guard TEXT;
BEGIN
  IF get_user_role() <> 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only a super admin can advance the academic period.');
  END IF;

  SELECT * INTO v_cur FROM semesters WHERE is_current = TRUE LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_CURRENT', 'message', 'No current semester is set. Set one in Academic Periods first.');
  END IF;

  SELECT value INTO v_guard FROM settings WHERE key = 'promotion_rollover_to_semester_id';
  IF v_guard IS NOT NULL AND v_guard = v_cur.id::text THEN
    RETURN jsonb_build_object('success', true, 'advanced', false, 'reason', 'ALREADY_ADVANCED');
  END IF;

  -- Next semester in the same year first ...
  SELECT id INTO v_next_id FROM semesters
  WHERE academic_year_id = v_cur.academic_year_id
    AND semester_number > v_cur.semester_number
    AND NOT is_archived
  ORDER BY semester_number LIMIT 1;

  -- ... otherwise Semester 1 of the next academic year by start date.
  IF v_next_id IS NULL THEN
    SELECT s.id INTO v_next_id
    FROM semesters s
    JOIN academic_years y ON y.id = s.academic_year_id
    JOIN academic_years cy ON cy.id = v_cur.academic_year_id
    WHERE y.start_date > cy.start_date
      AND NOT s.is_archived
    ORDER BY y.start_date, s.semester_number LIMIT 1;
  END IF;

  IF v_next_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_NEXT', 'message', 'Students promoted, but no next semester exists yet. Create it in Academic Periods to continue the new academic year.');
  END IF;

  PERFORM set_current_semester(v_next_id);

  INSERT INTO settings (key, value)
  VALUES ('promotion_rollover_to_semester_id', v_next_id::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  SELECT y.name, s.name INTO v_next_year, v_next_sem
  FROM semesters s JOIN academic_years y ON y.id = s.academic_year_id
  WHERE s.id = v_next_id;

  RETURN jsonb_build_object('success', true, 'advanced', true, 'year', v_next_year, 'semester', v_next_sem);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_academic_period_for_promotion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_academic_period_for_promotion() TO authenticated;
