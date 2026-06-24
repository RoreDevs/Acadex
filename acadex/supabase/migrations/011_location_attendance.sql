-- Location-based attendance verification
-- Adds GPS coordinate tracking for sessions and attendance records

-- Add location columns to sessions
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Add student location columns to attendance
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS student_latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS student_longitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;

-- Create index on location_verified for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_location_verified ON attendance(location_verified);

-- Settings table for admin-configurable system settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default attendance radius (200 meters)
INSERT INTO settings (key, value) VALUES ('attendance_radius_meters', '200')
ON CONFLICT (key) DO NOTHING;

-- RPC function: verify location and mark attendance server-side
-- Uses Haversine formula to calculate distance between student and classroom
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
BEGIN
  -- Verify caller is the student themselves
  IF auth.uid() <> p_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You can only mark attendance for yourself.');
  END IF;

  -- Verify session exists and is active
  SELECT is_active INTO v_session_active FROM sessions WHERE id = p_session_id;
  IF v_session_active IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Session not found.');
  END IF;
  IF NOT v_session_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_INACTIVE', 'message', 'Session has ended.');
  END IF;

  -- Check for duplicate attendance
  SELECT id INTO v_existing_id FROM attendance
  WHERE student_id = p_student_id AND session_id = p_session_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE', 'message', 'You have already marked attendance for this session.');
  END IF;

  -- Get session classroom location
  SELECT latitude, longitude INTO v_session_lat, v_session_lng
  FROM sessions WHERE id = p_session_id;

  -- Get configured radius (default 200 meters)
  SELECT COALESCE(
    (SELECT value::INTEGER FROM settings WHERE key = 'attendance_radius_meters'),
    200
  ) INTO v_radius_meters;

  -- If session has no location set, allow attendance without location check (backward compatible)
  IF v_session_lat IS NULL OR v_session_lng IS NULL THEN
    INSERT INTO attendance (student_id, session_id, status, student_latitude, student_longitude, location_verified)
    VALUES (p_student_id, p_session_id, 'present', p_student_lat, p_student_lng, FALSE)
    RETURNING id INTO v_existing_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'id', v_existing_id,
      'location_verified', FALSE,
      'message', 'Attendance marked successfully.'
    );
  END IF;

  -- Calculate distance using Haversine formula
  SELECT 2 * 6371000 * ASIN(SQRT(
    SIN(RADIANS(v_session_lat - p_student_lat) / 2)^2 +
    COS(RADIANS(v_session_lat)) * COS(RADIANS(p_student_lat)) *
    SIN(RADIANS(v_session_lng - p_student_lng) / 2)^2
  )) INTO v_distance;

  -- Check if student is within allowed radius
  IF v_distance > v_radius_meters THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'OUTSIDE_RADIUS',
      'distance', ROUND(v_distance::DECIMAL, 1),
      'radius', v_radius_meters,
      'message', 'You must be within the classroom area to mark attendance.'
    );
  END IF;

  -- Insert attendance record with location verified
  INSERT INTO attendance (student_id, session_id, status, student_latitude, student_longitude, location_verified)
  VALUES (p_student_id, p_session_id, 'present', p_student_lat, p_student_lng, TRUE)
  RETURNING id INTO v_existing_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'id', v_existing_id,
    'location_verified', TRUE,
    'distance', ROUND(v_distance::DECIMAL, 1),
    'message', 'Attendance marked successfully.'
  );
END;
$$;

-- Grant execute permission to authenticated users
REVOKE EXECUTE ON FUNCTION verify_attendance_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_attendance_location TO authenticated;

-- Create RLS policies for settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_settings" ON settings FOR SELECT USING (true);
CREATE POLICY "manage_settings_super" ON settings FOR ALL USING (get_user_role() = 'super_admin');
