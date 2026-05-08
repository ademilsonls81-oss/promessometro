import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.S_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export let supabase: any = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials missing - some features may not work');
  console.warn('   Required: S_URL and SERVICE_ROLE_KEY environment variables');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase admin client initialized');
  } catch (err: any) {
    console.error('❌ Failed to initialize Supabase:', err.message);
  }
}