import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.S_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing!');
  console.error('   S_URL:', supabaseUrl ? '✓ set' : '✗ missing');
  console.error('   SERVICE_ROLE_KEY:', supabaseKey ? '✓ set' : '✗ missing');
  throw new Error('Missing Supabase credentials: S_URL and SERVICE_ROLE_KEY are required');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase admin client initialized');