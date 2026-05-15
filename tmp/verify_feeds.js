
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data: result, error } = await supabase
    .from('feeds')
    .select('name, url, category')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) {
    console.error("Error fetching feeds:", error.message);
  } else {
    console.log("VERIFICATION RESULT:");
    console.table(result);
  }
}

verify();
