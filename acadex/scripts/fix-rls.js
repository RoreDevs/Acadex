const { createClient } = require('@supabase/supabase-js');

const url = 'https://shmsnfghoauljbmwulei.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobXNuZmdob2F1bGpibXd1bGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Mjk5MzEsImV4cCI6MjA5MzIwNTkzMX0.WG0D2P4pSAerO40PXpagldDLnTv3unP2nRsscTZePbQ';

const sup = createClient(url, key);

const statements = [
  // Helper function
  `CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;`,

  // Drop old policies that cause infinite recursion
  `DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;`,
  `DROP POLICY IF EXISTS "Super admins can update any profile" ON profiles;`,
  `DROP POLICY IF EXISTS "Super admins can delete profiles" ON profiles;`,
  `DROP POLICY IF EXISTS "Admins can create sessions" ON sessions;`,
  `DROP POLICY IF EXISTS "Admins can update own sessions" ON sessions;`,
  `DROP POLICY IF EXISTS "Admins can delete own sessions" ON sessions;`,
  `DROP POLICY IF EXISTS "Admins can view attendance in their program" ON attendance;`,
  `DROP POLICY IF EXISTS "Super admins can manage attendance" ON attendance;`,
  `DROP POLICY IF EXISTS "Super admins can view audit logs" ON audit_logs;`,
  `DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;`,
  `DROP POLICY IF EXISTS "Super admins can manage programs" ON programs;`,
  `DROP POLICY IF EXISTS "Super admins can manage courses" ON courses;`,
  `DROP POLICY IF EXISTS "Super admins can manage enrollments" ON enrollments;`,
  `DROP POLICY IF EXISTS "Admins can view enrollments in their program" ON enrollments;`,

  // Recreate with non-recursive helper function
  `CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT
    USING (get_user_role() IN ('admin', 'super_admin'));`,

  `CREATE POLICY "Super admins can update any profile" ON profiles FOR UPDATE
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "Super admins can delete profiles" ON profiles FOR DELETE
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "Admins can create sessions" ON sessions FOR INSERT
    WITH CHECK (get_user_role() IN ('admin', 'super_admin'));`,

  `CREATE POLICY "Admins can update own sessions" ON sessions FOR UPDATE
    USING (get_user_role() IN ('admin', 'super_admin'));`,

  `CREATE POLICY "Admins can delete own sessions" ON sessions FOR DELETE
    USING (get_user_role() IN ('admin', 'super_admin'));`,

  `CREATE POLICY "Admins can view attendance" ON attendance FOR SELECT
    USING (get_user_role() IN ('admin', 'super_admin'));`,

  `CREATE POLICY "Super admins can manage attendance" ON attendance FOR ALL
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "Super admins can view audit logs" ON audit_logs FOR SELECT
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT
    WITH CHECK (true);`,

  `CREATE POLICY "Super admins can manage programs" ON programs FOR ALL
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "Super admins can manage courses" ON courses FOR ALL
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "Super admins can manage enrollments" ON enrollments FOR ALL
    USING (get_user_role() = 'super_admin');`,

  `CREATE POLICY "Admins can view enrollments" ON enrollments FOR SELECT
    USING (get_user_role() IN ('admin', 'super_admin'));`,
];

async function run() {
  console.log('Executing SQL statements...\n');
  for (const sql of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.log(`FAIL: ${sql.slice(0, 80)}...`);
        console.log(`  Error: ${error.message}\n`);
      } else {
        console.log(`OK: ${sql.slice(0, 80)}...\n`);
      }
    } catch (e) {
      console.log(`EXCEPTION: ${e.message}`);
    }
  }
  console.log('\nDone. Now seeding courses...');
}

run();
