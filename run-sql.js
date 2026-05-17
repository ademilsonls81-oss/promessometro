import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function query(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error:', error.message);
    return null;
  }
  return data;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node run-sql.js "SELECT * FROM promises LIMIT 5"');
  process.exit(0);
}

const sql = args.join(' ');
console.log('Executing:', sql);

const result = await query(sql);
console.log(JSON.stringify(result, null, 2));