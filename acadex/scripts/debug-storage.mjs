import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Run with: node --env-file=.env <script>');
}

const supabase = createClient(url, key);

async function main() {
  // Check bucket
  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket('slides');
  console.log('Bucket:', bucketErr ? `Error: ${bucketErr.message}` : JSON.stringify(bucket));

  // Try uploading a tiny test file
  const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('slides')
    .upload('test.txt', testFile);
  console.log('Upload:', uploadErr ? `Error: ${uploadErr.message}` : 'Success: ' + JSON.stringify(uploadData));

  if (uploadErr) {
    // Try to list files
    const { data: files, error: listErr } = await supabase.storage
      .from('slides')
      .list();
    console.log('List:', listErr ? `Error: ${listErr.message}` : `${files?.length || 0} files`);

    // Try to check auth session
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session:', session ? `User: ${session.user?.id}` : 'No session');
    console.log('Auth role:', session?.user?.role);
  }
}

main().catch(console.error);
