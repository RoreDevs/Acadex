const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing .env variables. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(filePath) {
  console.log(`\nRunning: ${path.basename(filePath)}`);
  const sql = fs.readFileSync(filePath, 'utf8');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
    if (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate') || error.message.includes('already')) {
        console.log(`  SKIP (exists): ${stmt.slice(0, 60)}...`);
      } else if (error.message.includes('function exec_sql')) {
        console.error('  RPC function "exec_sql" not found. Trying direct query...');
        return { method: 'rpc', error: error.message };
      } else {
        console.error(`  ERROR: ${error.message}`);
      }
    } else {
      console.log(`  OK: ${stmt.slice(0, 60)}...`);
    }
  }
  return { method: 'rpc' };
}

async function execViaRest(sql) {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'params=multiple',
        },
        body: JSON.stringify({ query: stmt + ';' }),
      });
      if (!response.ok) {
        const text = await response.text();
        if (text.includes('already exists') || text.includes('duplicate')) {
          console.log(`  SKIP (exists): ${stmt.slice(0, 60)}...`);
        } else {
          console.log(`  WARN (${response.status}): ${text.slice(0, 100)}`);
        }
      } else {
        console.log(`  OK: ${stmt.slice(0, 60)}...`);
      }
    } catch (err) {
      console.log(`  WARN: ${err.message}`);
    }
  }
}

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('Migrating Supabase database...\n');

  // First, try to create the exec_sql function
  const createFunc = `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

  try {
    await execViaRest(createFunc);
  } catch (e) {
    console.log('Could not create exec_sql function via REST. Trying RPC...');
  }

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      const result = await runMigration(filePath);
      if (result.method === 'rpc' && result.error) {
        await execViaRest(sql);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}. Trying REST fallback...`);
      await execViaRest(sql);
    }
  }

  // Verify tables
  console.log('\nVerifying tables...');
  const tables = ['profiles', 'programs', 'courses', 'enrollments', 'sessions', 'attendance', 'notifications', 'audit_logs', 'slides'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.log(`  ${table}: NOT FOUND (${error.message})`);
    } else {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`  ${table}: EXISTS (${count || 0} rows)`);
    }
  }

  console.log('\nMigration complete!');
}

main().catch(console.error);
