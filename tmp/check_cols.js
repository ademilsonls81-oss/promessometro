
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (data && data.length > 0) {
      console.log(`${table} COLUMNS:`, Object.keys(data[0]));
  } else {
      console.log(`${table} is empty.`);
  }
}

async function run() {
    await checkCols('cron_executions');
    await checkCols('daily_monitor_log');
}
run();
