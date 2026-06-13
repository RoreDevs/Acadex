-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- It creates the 'slides' storage bucket and sets up proper access policies.

-- Create the storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('slides', 'slides', TRUE, FALSE, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to slides
DROP POLICY IF EXISTS "Public can view slides" ON storage.objects;
CREATE POLICY "Public can view slides"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'slides');

-- Allow admins and super admins to upload slides
DROP POLICY IF EXISTS "Admins and super admins can upload slides" ON storage.objects;
CREATE POLICY "Admins and super admins can upload slides"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'slides' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Allow admins and super admins to delete slides from storage
DROP POLICY IF EXISTS "Admins and super admins can delete slides from storage" ON storage.objects;
CREATE POLICY "Admins and super admins can delete slides from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'slides' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
