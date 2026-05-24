import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const dbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Testing update on Paulo Dantas...');
  const { data, error } = await dbAdmin.from('politicians')
    .update({ role: 'Governador' })
    .eq('id', 'f17a5688-6616-43b8-a6d1-419b4fcb5358')
    .select();
  
  console.log('Update result:', JSON.stringify(data, null, 2));
  console.log('Update error:', error);
}
main();
