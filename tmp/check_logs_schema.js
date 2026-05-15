
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: c1 } = await supabase.from('cron_executions').select('*').limit(1);
  const { data: c2 } = await supabase.from('daily_monitor_log').select('*').limit(1);

  console.log("CRON_EXECUTIONS COLUMNS:", Object.keys(c1?.[0] || {}));
  console.log("DAILY_MONITOR_LOG COLUMNS:", Object.keys(c2?.[0] || {}));
}

check();
