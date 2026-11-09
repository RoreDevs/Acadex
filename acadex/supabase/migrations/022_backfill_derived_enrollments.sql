-- 022: Backfill derived enrolments (optional, run separately)
-- ============================================================
-- Split out of 021 on purpose: a per-course backfill over every profile is the
-- only expensive step, and it must not be able to roll back the schema work or
-- the attendance function replacements in 021.
--
-- PRE-CONDITIONS
--   * 021_unify_attendance_eligibility.sql has been applied.
--   * enrollments.source exists (021, section 1).
--
-- WHAT IT DOES
--   One set-based INSERT ... SELECT. For every student/admin whose programme
--   resolves and whose level is non-empty, it inserts the courses registered
--   for that (programme, level) with source = 'derived'.
--
-- WHAT IT DOES NOT DO
--   * It never reads or deletes explicit enrolments.
--   * It deletes nothing at all.
--   * It cannot duplicate: UNIQUE(student_id, course_id) plus
--     ON CONFLICT DO NOTHING.
--   * It skips rows whose programme cannot be resolved
--     (program_id_for_profile -> NULL) or whose level normalises to ''.
--     Those are reported by count, not guessed at.
--
-- IDEMPOTENCY
--   Re-running inserts 0 rows. Safe to run more than once, and safe to run
--   after the triggers have already populated rows.
--
-- TIMEOUT
--   Explicit: statement_timeout is disabled for this script only. It is a
--   session setting, not persisted in the database. If your runner wraps the
--   file in a transaction, the setting still applies to that transaction.
--   If the runner imposes its own hard limit, run this as a single statement
--   (the INSERT below) rather than through the editor's batch mode.
-- ============================================================

SET statement_timeout = 0;

DO $$
DECLARE
  v_before     BIGINT;
  v_inserted   BIGINT;
  v_after      BIGINT;
  v_unresolved BIGINT;
BEGIN
  SELECT count(*) INTO v_before FROM enrollments;

  SELECT count(*) INTO v_unresolved
  FROM profiles p
  WHERE p.role IN ('student', 'admin')
    AND (
      public.program_id_for_profile(p.program) IS NULL
      OR public.normalize_level(p.level) = ''
    );

  INSERT INTO enrollments (student_id, course_id, source)
  SELECT p.id, x.course_id, 'derived'
  FROM profiles p
  JOIN LATERAL (
    SELECT c.id AS course_id
    FROM courses c
    WHERE c.program_id = public.program_id_for_profile(p.program)
      AND public.normalize_level(c.level) = public.normalize_level(p.level)
    UNION
    SELECT cc.course_id
    FROM curriculum_courses cc
    WHERE cc.program_id = public.program_id_for_profile(p.program)
      AND public.normalize_level(cc.level) = public.normalize_level(p.level)
  ) x ON TRUE
  WHERE p.role IN ('student', 'admin')
    AND public.program_id_for_profile(p.program) IS NOT NULL
    AND public.normalize_level(p.level) <> ''
  ON CONFLICT (student_id, course_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  SELECT count(*) INTO v_after FROM enrollments;

  RAISE NOTICE 'enrolments before: %, derived rows inserted: %, total after: %',
    v_before, v_inserted, v_after;
  RAISE NOTICE 'profiles skipped (unresolved programme or empty level): %', v_unresolved;
END $$;

-- Restore the runner default for anything executed after this script in the
-- same session. Harmless if the runner already closed the session.
RESET statement_timeout;

-- ============================================================
-- ROLLBACK
--   Nothing needs reverting: the script only inserts rows that are tagged
--   source = 'derived'. If they must be removed (and only then):
--     DELETE FROM enrollments WHERE source = 'derived';
--   Consequence: analytics denominators shrink back to the explicit-only
--   population. Marking eligibility is unaffected either way.
-- ============================================================
