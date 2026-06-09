// Run this in your browser console when logged into Acadex
// Or use Node.js: node scripts/seed.js

async function seedDatabase() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  const supabase = createClient(
    'https://shmsnfghoauljbmwulei.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobXNuZmdob2F1bGpibXd1bGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Mjk5MzEsImV4cCI6MjA5MzIwNTkzMX0.WG0D2P4pSAerO40PXpagldDLnTv3unP2nRsscTZePbQ'
  );

  const programs = [
    { name: 'BTECH ICT', code: 'BTECH-ICT' },
    { name: 'BTECH COMPUTER SCIENCE', code: 'BTECH-CS' },
    { name: 'HND NETWORKING', code: 'HND-NET' },
    { name: 'HND COMPUTER SCIENCE', code: 'HND-CS' },
  ];

  console.log('Seeding programs...');
  for (const p of programs) {
    const { data, error } = await supabase.from('programs').upsert(p, { onConflict: 'code' }).select();
    if (error) console.error(`  Error inserting ${p.name}:`, error.message);
    else console.log(`  OK: ${p.name}`);
  }

  // Fetch programs to get their IDs
  const { data: existingPrograms } = await supabase.from('programs').select('*');
  console.log('\nPrograms in database:', existingPrograms?.length || 0);

  const courses = [
    { code: 'ICT101', title: 'Programming Fundamentals', level: 'Level 100', credits: 3 },
    { code: 'ICT102', title: 'Database Systems', level: 'Level 100', credits: 3 },
    { code: 'ICT103', title: 'Computer Networks', level: 'Level 100', credits: 3 },
    { code: 'ICT104', title: 'Web Development', level: 'Level 100', credits: 3 },
    { code: 'ICT105', title: 'Software Engineering', level: 'Level 100', credits: 3 },
    { code: 'ICT201', title: 'Advanced Programming', level: 'Level 200', credits: 3 },
    { code: 'ICT202', title: 'Cyber Security', level: 'Level 200', credits: 3 },
    { code: 'ICT203', title: 'Data Structures & Algorithms', level: 'Level 200', credits: 3 },
    { code: 'ICT204', title: 'Mobile App Development', level: 'Level 200', credits: 3 },
    { code: 'ICT205', title: 'Cloud Computing', level: 'Level 200', credits: 3 },
    { code: 'CS101', title: 'Introduction to Computer Science', level: 'Level 100', credits: 3 },
    { code: 'CS102', title: 'Discrete Mathematics', level: 'Level 100', credits: 3 },
    { code: 'CS201', title: 'Data Structures', level: 'Level 200', credits: 3 },
    { code: 'CS202', title: 'Operating Systems', level: 'Level 200', credits: 3 },
    { code: 'NET101', title: 'Network Fundamentals', level: 'Level 100', credits: 3 },
    { code: 'NET102', title: 'Routing & Switching', level: 'Level 100', credits: 3 },
    { code: 'NET201', title: 'Network Security', level: 'Level 200', credits: 3 },
    { code: 'NET202', title: 'Wireless Networks', level: 'Level 200', credits: 3 },
  ];

  console.log('\nSeeding courses...');
  for (const c of courses) {
    const { error } = await supabase.from('courses').upsert(
      { ...c, program_id: existingPrograms?.[0]?.id },
      { onConflict: 'code' }
    );
    if (error) console.error(`  Error inserting ${c.title}:`, error.message);
    else console.log(`  OK: ${c.code} - ${c.title}`);
  }

  // Check all tables
  const tables = ['profiles', 'programs', 'courses', 'sessions', 'attendance', 'enrollments', 'notifications', 'audit_logs'];
  console.log('\n=== Table Status ===');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) console.log(`  ${table}: ERROR - ${error.message}`);
    else console.log(`  ${table}: ${count} rows`);
  }
}

seedDatabase().then(() => console.log('\nDone!')).catch(console.error);
