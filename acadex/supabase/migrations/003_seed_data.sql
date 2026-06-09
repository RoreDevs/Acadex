-- Seed data for Acadex
-- Optional: Run after migrations to populate initial data

-- Insert programs
INSERT INTO programs (name, code) VALUES
  ('BTECH ICT', 'BTECH-ICT'),
  ('BTECH COMPUTER SCIENCE', 'BTECH-CS'),
  ('HND NETWORKING', 'HND-NET'),
  ('HND COMPUTER SCIENCE', 'HND-CS')
ON CONFLICT (code) DO NOTHING;

-- Insert courses for BTECH ICT Level 100
WITH p AS (SELECT id FROM programs WHERE code = 'BTECH-ICT')
INSERT INTO courses (code, title, program_id, level, credits) VALUES
  ('ICT101', 'Programming Fundamentals', (SELECT id FROM p), 'Level 100', 3),
  ('ICT102', 'Database Systems', (SELECT id FROM p), 'Level 100', 3),
  ('ICT103', 'Computer Networks', (SELECT id FROM p), 'Level 100', 3),
  ('ICT104', 'Web Development', (SELECT id FROM p), 'Level 100', 3),
  ('ICT105', 'Software Engineering', (SELECT id FROM p), 'Level 100', 3)
ON CONFLICT DO NOTHING;

-- Insert courses for BTECH ICT Level 200
WITH p AS (SELECT id FROM programs WHERE code = 'BTECH-ICT')
INSERT INTO courses (code, title, program_id, level, credits) VALUES
  ('ICT201', 'Advanced Programming', (SELECT id FROM p), 'Level 200', 3),
  ('ICT202', 'Cyber Security Fundamentals', (SELECT id FROM p), 'Level 200', 3),
  ('ICT203', 'Data Structures & Algorithms', (SELECT id FROM p), 'Level 200', 3),
  ('ICT204', 'Mobile App Development', (SELECT id FROM p), 'Level 200', 3),
  ('ICT205', 'Cloud Computing', (SELECT id FROM p), 'Level 200', 3)
ON CONFLICT DO NOTHING;

-- Insert enrollments for demo (only if demo user exists)
-- This assumes a demo student with index 'DEMO001' exists
-- Replace with actual user logic
DO $$
DECLARE
  demo_user_id UUID;
  course_record RECORD;
BEGIN
  SELECT id INTO demo_user_id FROM profiles WHERE index_number = 'DEMO001' LIMIT 1;
  IF demo_user_id IS NOT NULL THEN
    FOR course_record IN SELECT id FROM courses WHERE level = 'Level 100' AND program_id = (SELECT id FROM programs WHERE code = 'BTECH-ICT')
    LOOP
      INSERT INTO enrollments (student_id, course_id)
      VALUES (demo_user_id, course_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;
