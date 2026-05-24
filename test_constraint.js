import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await db.rpc('exec_sql', { sql: "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'politicians'::regclass;" });
  if (error) {
    console.error('Error fetching data:', error);
    process.exit(0);
  }
  console.log('---DB_DATA---');
  console.log(JSON.stringify(data, null, 2));
  console.log('---END_DATA---');
}
main();
