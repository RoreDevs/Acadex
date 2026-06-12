-- Add sender tracking to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broadcast_id UUID,
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Index for looking up sent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(broadcast_id);

-- Allow super admins to view notifications they sent, plus all users see own
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid() OR
    sender_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Allow super admins to update notifications they sent (for editing broadcasts)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    user_id = auth.uid() OR
    sender_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Allow super admins to delete any notification (broadcasts)
DROP POLICY IF EXISTS "Super admins can delete notifications" ON notifications;
CREATE POLICY "Super admins can delete notifications"
  ON notifications FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
