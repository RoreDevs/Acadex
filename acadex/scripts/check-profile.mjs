import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Run with: node --env-file=.env <script>');
}

const supabase = createClient(url, key);

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
