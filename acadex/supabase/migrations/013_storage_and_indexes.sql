-- 013: Storage (assignments bucket), indexes, and slides bucket hardening

-- ============================================================
-- F: Create the missing `assignments` storage bucket + policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignments',
  'assignments',
  TRUE,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "assignments public read" ON storage.objects;
CREATE POLICY "assignments public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'assignments');

DROP POLICY IF EXISTS "assignments admin write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignments'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "assignments admin delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assignments'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Harden the slides bucket: restrict MIME types and size
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'text/plain'
    ]
WHERE id = 'slides';

-- ============================================================
-- D/H: Useful indexes for common read patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_program_level_active ON sessions(program_id, level, is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_student ON attendance(session_id, student_id);
