import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://shmsnfghoauljbmwulei.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobXNuZmdob2F1bGpibXd1bGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Mjk5MzEsImV4cCI6MjA5MzIwNTkzMX0.WG0D2P4pSAerO40PXpagldDLnTv3unP2nRsscTZePbQ'
);

async function main() {
  // Try to get the current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user?.id, user?.email);

  // Try to get their profile
  if (user?.id) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('id', user.id)
      .single();
    console.log('Profile:', error ? `Error: ${error.message}` : JSON.stringify(profile));
  }

  // List all profiles (if allowed)
  const { data: allProfiles, error: listError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .limit(10);
  console.log('All profiles:', listError ? `Error: ${listError.message}` : JSON.stringify(allProfiles));
}

main().catch(console.error);
