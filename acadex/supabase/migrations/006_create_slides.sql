-- Create slides table for course materials
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slides_course ON slides(course_id);
CREATE INDEX IF NOT EXISTS idx_slides_program ON slides(program_id);
CREATE INDEX IF NOT EXISTS idx_slides_uploader ON slides(uploaded_by);

-- RLS
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view slides"
  ON slides FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins and super admins can insert slides"
  ON slides FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Super admins can delete slides"
  ON slides FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admins can delete own slides"
  ON slides FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Create storage bucket for slides
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('slides', 'slides', TRUE, FALSE, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to slides bucket
CREATE POLICY "Public can view slides"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'slides');

CREATE POLICY "Admins and super admins can upload slides"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'slides' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Admins and super admins can delete slides from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'slides' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
